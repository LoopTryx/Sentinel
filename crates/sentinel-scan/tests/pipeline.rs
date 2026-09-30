use sentinel_scan::pipeline::{
    DirectoryLimits, ScanLimits, ScanState, scan_directory, scan_file, scan_stream,
};
use std::fs;

fn fixture_dir() -> std::path::PathBuf {
    let path = std::env::temp_dir().join(format!(
        "sentinel-scan-{}-{}",
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
fn approved_stream_respects_byte_limit_without_file_path() {
    let mut input = std::io::Cursor::new(b"stream fixture".to_vec());
    let result = scan_stream(&mut input, ScanLimits { max_file_bytes: 4 }, &mut || false);
    assert_eq!(result.state, ScanState::SkippedLimit);
    assert_eq!(result.files_checked, 0);
    assert!(result.sha256.is_none());
}

#[test]
fn eicar_stream_is_detected_without_writing_a_test_file() {
    let marker = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    let mut bytes = vec![b'.'; 8190];
    bytes.extend_from_slice(marker);
    let result = scan_stream(
        &mut std::io::Cursor::new(bytes),
        ScanLimits::default(),
        &mut || false,
    );
    assert_eq!(result.state, ScanState::TestSignatureFound);
    assert_eq!(result.files_checked, 1);
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

#[test]
fn folder_scan_counts_checked_and_skipped_files_without_clean_claim() {
    let dir = fixture_dir();
    fs::create_dir(dir.join("nested")).unwrap();
    fs::write(dir.join("clean.txt"), b"fixture").unwrap();
    fs::write(dir.join("large.txt"), b"more than eight bytes").unwrap();
    fs::write(dir.join("nested/third.txt"), b"third fixture").unwrap();
    let report = scan_directory(
        &dir,
        ScanLimits { max_file_bytes: 80 },
        DirectoryLimits::default(),
        || false,
    );
    assert!(report.complete, "{report:?}");
    assert_eq!(report.files_visited, 3);
    assert_eq!(report.files_checked, 3);
    assert!(report.findings.is_empty());
    let limited = scan_directory(
        &dir,
        ScanLimits { max_file_bytes: 8 },
        DirectoryLimits::default(),
        || false,
    );
    assert_eq!(limited.files_checked, 1);
    assert_eq!(limited.files_skipped, 2);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn folder_scan_reports_cancelled_and_entry_limit_as_incomplete() {
    let dir = fixture_dir();
    fs::write(dir.join("one.txt"), b"one").unwrap();
    fs::write(dir.join("two.txt"), b"two").unwrap();
    let cancelled = scan_directory(
        &dir,
        ScanLimits::default(),
        DirectoryLimits::default(),
        || true,
    );
    assert!(cancelled.cancelled);
    assert!(!cancelled.complete);
    assert_eq!(cancelled.files_checked, 0);
    let limited = scan_directory(
        &dir,
        ScanLimits::default(),
        DirectoryLimits {
            max_entries: 1,
            ..DirectoryLimits::default()
        },
        || false,
    );
    assert!(limited.limit_reached);
    assert!(!limited.complete);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn cancellation_during_large_file_does_not_count_it_as_checked() {
    let dir = fixture_dir();
    fs::write(dir.join("large.txt"), vec![b'x'; 20_000]).unwrap();
    let mut polls = 0;
    let report = scan_directory(
        &dir,
        ScanLimits::default(),
        DirectoryLimits::default(),
        || {
            polls += 1;
            polls >= 3
        },
    );
    assert!(report.cancelled);
    assert_eq!(report.files_checked, 0);
    assert_eq!(report.files_skipped, 1);
    assert!(!report.complete);
    fs::remove_dir_all(dir).unwrap();
}
