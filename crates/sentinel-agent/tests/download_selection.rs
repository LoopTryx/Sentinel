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
