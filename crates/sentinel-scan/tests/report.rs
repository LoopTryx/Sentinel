use sentinel_scan::{
    pipeline::{ScanLimits, scan_file, scan_file_with_cancel},
    report::selected_file_report,
};
use std::{fs, path::PathBuf};
fn fixture() -> PathBuf {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let path = std::env::temp_dir().join(format!(
        "sentinel-report-{}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    ));
    fs::create_dir(&path).unwrap();
    path
}
#[test]
fn actual_file_results_keep_binding_partial_coverage_and_no_path() {
    let dir = fixture();
    let file = dir.join("private-name.txt");
    fs::write(&file, b"benign").unwrap();
    let cases = [
        (
            scan_file(&file, ScanLimits::default()),
            "no_known_finding",
            "6",
            "1",
        ),
        (
            scan_file(&file, ScanLimits { max_file_bytes: 1 }),
            "skipped_limit",
            "0",
            "0",
        ),
        (
            scan_file(dir.join("missing"), ScanLimits::default()),
            "access_error",
            "0",
            "0",
        ),
        (
            scan_file_with_cancel(&file, ScanLimits::default(), &mut || true),
            "cancelled",
            "0",
            "0",
        ),
    ];
    for (raw, state, bytes, checked) in cases {
        let report = selected_file_report(&raw, "job-7", "selection_3").unwrap();
        let json = serde_json::to_value(report).unwrap();
        assert_eq!(json["jobId"], "job-7");
        assert_eq!(json["selectionRef"], "selection_3");
        assert_eq!(json["state"], state);
        assert_eq!(json["bytesRead"], bytes);
        assert_eq!(json["filesChecked"], checked);
        assert_eq!(json["coverage"], "partial");
        assert_eq!(json["fullSignatureEngineActive"], false);
        assert_eq!(json["sha256"], serde_json::to_value(raw.sha256).unwrap());
        let text = json.to_string();
        assert!(!text.contains("private-name"));
        assert!(!text.contains("benign"));
        assert!(text.len() < 1024);
    }
    fs::remove_dir_all(dir).unwrap();
}
#[test]
fn reject_unbounded_or_pathlike_correlation_without_echoing_it() {
    let raw = scan_file_with_cancel("not-read", ScanLimits::default(), &mut || true);
    for bad in [
        "".to_string(),
        "x".repeat(65),
        "../private".into(),
        "C:\\secret".into(),
        "é".into(),
        "a b".into(),
        "a\n".into(),
    ] {
        for (job, selection) in [(&bad[..], "valid"), ("valid", &bad[..])] {
            let error = selected_file_report(&raw, job, selection).unwrap_err();
            assert_eq!(error.to_string(), "invalid scan correlation reference");
        }
    }
    assert!(selected_file_report(&raw, &"a".repeat(64), "A_0-z").is_ok());
}

#[test]
fn every_outcome_and_full_width_counter_is_preserved_without_rounding() {
    use sentinel_scan::pipeline::ScanState;
    let mut raw = scan_file_with_cancel("not-read", ScanLimits::default(), &mut || true);
    for (state, expected) in [
        (ScanState::NoKnownFinding, "no_known_finding"),
        (ScanState::TestSignatureFound, "test_signature_found"),
        (ScanState::SkippedLimit, "skipped_limit"),
        (ScanState::SkippedUnsupported, "skipped_unsupported"),
        (ScanState::AccessError, "access_error"),
        (ScanState::ChangedDuringScan, "changed_during_scan"),
        (ScanState::Cancelled, "cancelled"),
    ] {
        // Contract conversion only, not live detection of these outcomes.
        raw.state = state;
        raw.bytes_read = u64::MAX;
        let json =
            serde_json::to_value(selected_file_report(&raw, "job-1", "selection-1").unwrap())
                .unwrap();
        assert_eq!(json["state"], expected);
        assert_eq!(json["bytesRead"], "18446744073709551615");
        assert_eq!(json["coverage"], "partial");
    }
}

#[test]
fn actual_interrupted_bytes_do_not_gain_hash_or_checked_coverage() {
    let dir = fixture();
    let file = dir.join("sample.txt");
    fs::write(&file, vec![b'a'; 20_000]).unwrap();
    let mut polls = 0;
    let raw = scan_file_with_cancel(&file, ScanLimits::default(), &mut || {
        polls += 1;
        polls >= 3
    });
    let json =
        serde_json::to_value(selected_file_report(&raw, "job-old", "selection-old").unwrap())
            .unwrap();
    assert_eq!(json["state"], "cancelled");
    assert_eq!(json["bytesRead"], "8192");
    assert_eq!(json["sha256"], serde_json::Value::Null);
    assert_eq!(json["filesChecked"], "0");
    // A fresh operation keeps distinct IDs; presentation must compare both.
    let fresh = serde_json::to_value(
        selected_file_report(
            &scan_file(&file, ScanLimits::default()),
            "job-new",
            "selection-new",
        )
        .unwrap(),
    )
    .unwrap();
    assert_ne!(json["jobId"], fresh["jobId"]);
    assert_ne!(json["selectionRef"], fresh["selectionRef"]);
    assert_eq!(fresh["filesChecked"], "1");
    fs::remove_dir_all(dir).unwrap();
}
