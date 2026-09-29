use shield_scan::pipeline::{ScanLimits, ScanState, scan_file};
use std::fs;

fn fixture_dir() -> std::path::PathBuf {
    let path = std::env::temp_dir().join(format!(
        "cybershield-scan-{}-{}",
        std::process::id(),
        std::thread::current().name().unwrap_or("fixture")
    ));
    let _ = fs::remove_dir_all(&path);
    fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn benign_file_is_checked_with_partial_engine_coverage() {
    let dir = fixture_dir();
    let path = dir.join("benign.txt");
    fs::write(&path, b"harmless fixture").unwrap();
    let result = scan_file(&path, ScanLimits::default());
    assert_eq!(result.state, ScanState::NoKnownFinding);
    assert_eq!(result.files_checked, 1);
    assert_eq!(result.engine_failures, 0);
    assert!(!result.full_signature_engine_active);
    assert!(result.sha256.is_some());
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn eicar_fixture_is_detected_even_across_read_boundaries() {
    let dir = fixture_dir();
    let path = dir.join("eicar.txt");
    let marker = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    let mut bytes = vec![b'.'; 8190];
    bytes.extend_from_slice(marker);
    fs::write(&path, bytes).unwrap();
    let result = scan_file(&path, ScanLimits::default());
    assert_eq!(result.state, ScanState::TestSignatureFound);
    assert_eq!(result.files_checked, 1);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn oversized_or_unreadable_items_are_never_counted_as_checked() {
    let dir = fixture_dir();
    let path = dir.join("large.txt");
    fs::write(&path, b"more than four bytes").unwrap();
    let result = scan_file(&path, ScanLimits { max_file_bytes: 4 });
    assert_eq!(result.state, ScanState::SkippedLimit);
    assert_eq!(result.files_checked, 0);
    assert_eq!(result.files_skipped, 1);
    let missing = scan_file(dir.join("missing"), ScanLimits::default());
    assert_eq!(missing.state, ScanState::AccessError);
    assert_eq!(missing.files_checked, 0);
    assert_eq!(missing.access_errors, 1);
    fs::remove_dir_all(dir).unwrap();
}
