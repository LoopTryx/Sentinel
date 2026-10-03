use sentinel_proto::scan_progress::DirectoryScanStage;
use sentinel_scan::pipeline::{DirectoryLimits, ScanLimits, scan_directory_with_progress};
use std::{cell::Cell, fs, path::PathBuf};

fn fixture() -> PathBuf {
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir =
        std::env::temp_dir().join(format!("sentinel-progress-{}-{nonce}", std::process::id()));
    fs::create_dir(&dir).unwrap();
    dir
}

#[test]
fn actual_counters_advance_and_final_matches_report_without_paths() {
    let dir = fixture();
    fs::write(dir.join("one.txt"), b"one").unwrap();
    fs::write(dir.join("two.txt"), b"two").unwrap();
    let mut events = Vec::new();
    let report = scan_directory_with_progress(
        &dir,
        ScanLimits::default(),
        DirectoryLimits::default(),
        || false,
        |p| events.push(p.clone()),
    );
    assert_eq!(events.first().unwrap().stage, DirectoryScanStage::Running);
    assert_eq!(events[0].files_checked, 0);
    assert!(
        events
            .iter()
            .any(|p| p.stage == DirectoryScanStage::Running && p.files_checked == 1)
    );
    let last = events.last().unwrap();
    assert_eq!(last.stage, DirectoryScanStage::Finished);
    assert!(last.traversal_complete);
    assert_eq!(last.files_checked, report.files_checked);
    assert_eq!(last.bytes_read, report.bytes_read);
    assert_eq!(last.entries_visited, report.entries_visited);
    assert_eq!(last.bytes_read, 6);
    for pair in events.windows(2) {
        assert!(pair[1].entries_visited >= pair[0].entries_visited);
        assert!(pair[1].bytes_read >= pair[0].bytes_read);
    }
    let json = serde_json::to_string(last).unwrap();
    assert!(!json.contains("one.txt"));
    assert!(!json.contains("percent"));
    let wire: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(wire["bytesRead"], "6");
    let decoded: sentinel_proto::scan_progress::DirectoryScanProgress =
        serde_json::from_str(&json).unwrap();
    assert_eq!(&decoded, last);
    assert!(json.len() < 1024);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn observer_can_request_cancellation_without_counting_remaining_file() {
    let dir = fixture();
    fs::write(dir.join("one.txt"), b"one").unwrap();
    fs::write(dir.join("two.txt"), b"two").unwrap();
    let cancel = Cell::new(false);
    let mut events = Vec::new();
    let report = scan_directory_with_progress(
        &dir,
        ScanLimits::default(),
        DirectoryLimits::default(),
        || cancel.get(),
        |p| {
            if p.files_checked == 1 {
                cancel.set(true);
            }
            events.push(p.clone());
        },
    );
    assert!(report.cancelled);
    assert!(!report.complete);
    assert_eq!(report.files_checked, 1);
    let last = events.last().unwrap();
    assert!(last.cancelled);
    assert!(!last.traversal_complete);
    assert_eq!(last.files_checked, 1);
    assert_eq!(last.stage, DirectoryScanStage::Finished);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn final_limit_and_skipped_counters_remain_incomplete() {
    let dir = fixture();
    fs::write(dir.join("one.txt"), b"one").unwrap();
    fs::write(dir.join("two.txt"), b"two").unwrap();
    let mut events = Vec::new();
    let report = scan_directory_with_progress(
        &dir,
        ScanLimits { max_file_bytes: 1 },
        DirectoryLimits {
            max_entries: 1,
            ..DirectoryLimits::default()
        },
        || false,
        |p| events.push(p.clone()),
    );
    let last = events.last().unwrap();
    assert!(last.limit_reached);
    assert!(!last.traversal_complete);
    assert_eq!(last.files_checked, 0);
    assert_eq!(last.files_skipped, 1);
    assert_eq!(last.files_skipped, report.files_skipped);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn missing_root_still_delivers_final_error_snapshot() {
    let dir = fixture();
    let mut events = Vec::new();
    let report = scan_directory_with_progress(
        dir.join("missing"),
        ScanLimits::default(),
        DirectoryLimits::default(),
        || false,
        |p| events.push(p.clone()),
    );
    assert_eq!(events.len(), 2);
    let last = events.last().unwrap();
    assert_eq!(last.stage, DirectoryScanStage::Finished);
    assert_eq!(last.access_errors, 1);
    assert!(!last.traversal_complete);
    assert_eq!(last.access_errors, report.access_errors);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn initial_cancellation_is_honored_even_for_empty_directory() {
    let dir = fixture();
    let mut events = Vec::new();
    let report = scan_directory_with_progress(
        &dir,
        ScanLimits::default(),
        DirectoryLimits::default(),
        || true,
        |p| events.push(p.clone()),
    );
    assert!(report.cancelled);
    assert!(!report.complete);
    assert_eq!(report.entries_visited, 0);
    assert!(events.last().unwrap().cancelled);
    fs::remove_dir_all(dir).unwrap();
}
