use sentinel_agent::download_selection::{DownloadIngressError, decode_download_observation};
#[test]
fn ingress_is_bounded_and_semantically_validated() {
    let valid = br#"{"sessionRef":"s-1","downloadRef":"d-1"}"#;
    assert_eq!(
        decode_download_observation(valid).unwrap().download_ref,
        "d-1"
    );
    assert_eq!(
        decode_download_observation(&vec![b' '; 513]),
        Err(DownloadIngressError::TooLarge)
    );
    for invalid in [
        br#"{"sessionRef":"","downloadRef":"d-1"}"#.as_slice(),
        br#"{"sessionRef":"s-1","downloadRef":"../secret"}"#,
        br#"{"sessionRef":"s-1","downloadRef":"d-1","path":"secret"}"#,
        b"\xff",
    ] {
        let error = decode_download_observation(invalid).unwrap_err();
        assert_eq!(error, DownloadIngressError::InvalidObservation);
        assert!(!format!("{error:?}").contains("secret"));
    }
}

#[test]
fn ingress_boundary_and_duplicate_fields_cannot_bypass_validation() {
    let json = br#"{"sessionRef":"s-1","downloadRef":"d-1"}"#;
    let mut boundary = json.to_vec();
    boundary.resize(512, b' ');
    assert!(decode_download_observation(&boundary).is_ok());
    boundary.push(b' ');
    assert_eq!(
        decode_download_observation(&boundary),
        Err(DownloadIngressError::TooLarge)
    );
    for invalid in [
        br#"{"sessionRef":"s-1","sessionRef":"s-2","downloadRef":"d-1"}"#.as_slice(),
        br#"{"sessionRef":"s-1","downloadRef":"d-1","downloadRef":"d-2"}"#,
        br#"{"sessionRef":{"path":"private"},"downloadRef":"d-1"}"#,
        br#"["s-1","d-1"]"#,
        b"null",
    ] {
        assert_eq!(
            decode_download_observation(invalid),
            Err(DownloadIngressError::InvalidObservation)
        );
    }
    let oversized_reference = format!(
        r#"{{"sessionRef":"{}","downloadRef":"d-1"}}"#,
        "x".repeat(65)
    );
    assert_eq!(
        decode_download_observation(oversized_reference.as_bytes()),
        Err(DownloadIngressError::InvalidObservation)
    );
}

#[test]
fn reservation_preflight_bounds_global_and_owner_usage_without_overflow() {
    use sentinel_agent::download_selection::{
        DownloadReservationError, check_download_reservation,
    };
    assert!(check_download_reservation(7, 31, 248 * 1024 * 1024, 8 * 1024 * 1024).is_ok());
    assert_eq!(
        check_download_reservation(8, 8, 0, 1),
        Err(DownloadReservationError::Capacity)
    );
    assert_eq!(
        check_download_reservation(1, 32, 0, 1),
        Err(DownloadReservationError::Capacity)
    );
    assert_eq!(
        check_download_reservation(0, 0, 0, 8 * 1024 * 1024 + 1),
        Err(DownloadReservationError::TooLarge)
    );
    assert_eq!(
        check_download_reservation(0, 0, u64::MAX, 1),
        Err(DownloadReservationError::InvalidUsage)
    );
    assert_eq!(
        check_download_reservation(2, 1, 0, 1),
        Err(DownloadReservationError::InvalidUsage)
    );
}

#[test]
fn usage_cannot_charge_bytes_without_corresponding_live_slots() {
    use sentinel_agent::download_selection::{
        DownloadReservationError, check_download_reservation,
    };
    assert_eq!(
        check_download_reservation(0, 0, 1, 1),
        Err(DownloadReservationError::InvalidUsage)
    );
    assert_eq!(
        check_download_reservation(1, 1, 8 * 1024 * 1024 + 1, 1),
        Err(DownloadReservationError::InvalidUsage)
    );
}

#[test]
fn atomic_accounting_retains_charges_until_cleanup_succeeds() {
    use sentinel_agent::download_selection::reserve_download_accounting;
    let mut tickets = Vec::new();
    for _ in 0..8 {
        tickets.push(reserve_download_accounting("budget-test-owner", 1).unwrap());
    }
    assert!(reserve_download_accounting("budget-test-owner", 1).is_err());
    let ticket = tickets.pop().unwrap();
    let ticket = ticket.release_with_cleanup(|| Err(())).unwrap_err();
    assert!(reserve_download_accounting("budget-test-owner", 1).is_err());
    ticket.release_with_cleanup(|| Ok(())).unwrap();
    let replacement = reserve_download_accounting("budget-test-owner", 1).unwrap();
    replacement.release_with_cleanup(|| Ok(())).unwrap();
    for ticket in tickets {
        ticket.release_with_cleanup(|| Ok(())).unwrap();
    }
}
