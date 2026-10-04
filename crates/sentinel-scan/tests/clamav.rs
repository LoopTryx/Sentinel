use sentinel_proto::assessment::Coverage;
use sentinel_proto::clamav::{ClamAvReport, ClamAvState};
use sentinel_scan::clamav::interpret_result;

#[test]
fn completion_requires_matching_exit_and_single_expected_record() {
    assert_eq!(
        interpret_result(Some(0), b"stdin: OK\r\n").state,
        ClamAvState::NoKnownFinding
    );
    assert_eq!(
        interpret_result(Some(1), b"stdin: Synthetic.Test FOUND\n").state,
        ClamAvState::SignatureMatch
    );
    for (exit, text) in [
        (Some(2), "stdin: OK\n"),
        (Some(0), "stdin: Synthetic.Test FOUND\n"),
        (Some(1), "stdin: OK\n"),
        (None, "stdin: OK\n"),
        (Some(0), ""),
        (Some(0), "other: OK\n"),
        (Some(0), "stdin: OK\nstdin: OK\n"),
    ] {
        assert_eq!(
            interpret_result(exit, text.as_bytes()).state,
            ClamAvState::Failed
        );
    }
}

#[test]
fn unsupported_encrypted_and_limit_alerts_never_become_malware_or_clean() {
    for text in [
        "stdin: Heuristics.Limits.Exceeded.MaxFileSize FOUND\n",
        "stdin: Heuristics.Encrypted.Zip FOUND\n",
    ] {
        let report = interpret_result(Some(1), text.as_bytes());
        assert_eq!(report.state, ClamAvState::InspectionIncomplete);
        assert_eq!(report.coverage, Coverage::Partial);
    }
    assert_eq!(interpret_result(Some(0), &[255]).state, ClamAvState::Failed);
    assert_eq!(
        interpret_result(Some(0), &vec![b'x'; 32_769]).state,
        ClamAvState::Failed
    );
}

#[test]
fn reports_never_echo_private_engine_output_or_claim_complete_coverage() {
    let report: ClamAvReport = interpret_result(Some(1), b"stdin: PrivateSignatureName FOUND\n");
    assert_eq!(report.coverage, Coverage::Partial);
    assert!(
        !serde_json::to_string(&report)
            .unwrap()
            .contains("PrivateSignatureName")
    );
}

#[test]
fn disabled_configuration_and_precancel_do_not_launch_a_process() {
    use sentinel_scan::clamav::scan_benign_file;
    use std::{path::Path, time::Duration};
    assert_eq!(
        scan_benign_file(
            Path::new("missing"),
            Path::new("relative-engine"),
            Path::new("relative-db"),
            Duration::from_secs(1),
            || false
        )
        .state,
        ClamAvState::Unavailable
    );
    let root = std::env::current_dir().unwrap();
    assert_eq!(
        scan_benign_file(
            &root.join("missing"),
            &root.join("missing-engine"),
            &root.join("missing-db"),
            Duration::from_secs(1),
            || true
        )
        .state,
        ClamAvState::Cancelled
    );
}

#[test]
#[ignore = "requires explicitly configured verified ClamAV and harmless synthetic pack"]
fn official_engine_benign_journey_and_failure_states() {
    use sentinel_scan::clamav::scan_benign_file;
    use std::{
        path::PathBuf,
        time::{Duration, Instant},
    };
    let exe = PathBuf::from(std::env::var("SENTINEL_TEST_CLAMAV").expect("verified executable"));
    let db = PathBuf::from(std::env::var("SENTINEL_TEST_CLAMAV_DB").expect("synthetic DB"));
    let pack =
        PathBuf::from(std::env::var("SENTINEL_TEST_CLAMAV_SAMPLES").expect("benign samples"));
    for (name, expected) in [
        ("00-clean-control.txt", ClamAvState::NoKnownFinding),
        ("01-easy-marker.txt", ClamAvState::SignatureMatch),
        ("02-moderate-base64.json", ClamAvState::SignatureMatch),
        ("03-hard-fragmented.json", ClamAvState::SignatureMatch),
    ] {
        let r = scan_benign_file(&pack.join(name), &exe, &db, Duration::from_secs(20), || {
            false
        });
        assert_eq!(r.state, expected);
        assert_eq!(r.coverage, Coverage::Partial);
    }
    let sample = pack.join("00-clean-control.txt");
    assert_eq!(
        scan_benign_file(
            &sample,
            &exe,
            &db.with_file_name("missing-db.hdb"),
            Duration::from_secs(20),
            || false
        )
        .state,
        ClamAvState::Failed
    );
    let start = Instant::now();
    assert_eq!(
        scan_benign_file(&sample, &exe, &db, Duration::from_nanos(1), || false).state,
        ClamAvState::TimedOut
    );
    assert!(start.elapsed() < Duration::from_secs(5));
    // Admission remains occupied until the bounded pipe threads actually finish.
    let mut calls = 0;
    let start = Instant::now();
    loop {
        let r = scan_benign_file(&sample, &exe, &db, Duration::from_secs(20), || {
            calls += 1;
            calls >= 2
        });
        if r.state != ClamAvState::Busy {
            assert_eq!(r.state, ClamAvState::Cancelled);
            break;
        }
        assert!(start.elapsed() < Duration::from_secs(5));
        calls = 0;
        std::thread::sleep(Duration::from_millis(10));
    }
}
