use sentinel_proto::scan_progress::{DirectoryScanProgress, DirectoryScanStage};
use sentinel_scan::progress_slot::LatestScanProgress;
fn snapshot(count: u64, final_state: bool) -> DirectoryScanProgress {
    DirectoryScanProgress {
        stage: if final_state {
            DirectoryScanStage::Finished
        } else {
            DirectoryScanStage::Running
        },
        entries_visited: count,
        files_visited: count,
        files_checked: count,
        files_skipped: 0,
        access_errors: 0,
        engine_failures: 0,
        bytes_read: count,
        traversal_complete: final_state,
        cancelled: false,
        limit_reached: false,
    }
}
#[test]
fn wrong_identity_cannot_publish_read_or_freeze_and_final_cannot_regress() {
    let slot = LatestScanProgress::new("job-1", "selection-1").unwrap();
    assert!(!slot.publish("old-job", "selection-1", &snapshot(9, true)));
    assert!(!slot.publish("job-1", "old-selection", &snapshot(9, true)));
    assert!(slot.publish("job-1", "selection-1", &snapshot(2, false)));
    assert!(slot.latest("old-job", "selection-1").is_none());
    assert!(!slot.publish("job-1", "selection-1", &snapshot(1, false)));
    assert!(slot.publish("job-1", "selection-1", &snapshot(2, true)));
    assert!(!slot.publish("job-1", "selection-1", &snapshot(3, false)));
    let bound = slot.latest("job-1", "selection-1").unwrap();
    assert_eq!(bound.progress.stage, DirectoryScanStage::Finished);
    assert_eq!(bound.progress.bytes_read, 2);
    assert_eq!(bound.job_id, "job-1");
    assert_eq!(bound.selection_ref, "selection-1");
}
#[test]
fn slot_keeps_only_latest_and_close_rejects_concurrent_late_updates() {
    let slot = LatestScanProgress::new("j", "s").unwrap();
    for count in 0..1000 {
        assert!(slot.publish("j", "s", &snapshot(count, false)));
    }
    assert_eq!(slot.latest("j", "s").unwrap().progress.bytes_read, 999);
    let producer = slot.clone();
    std::thread::scope(|scope| {
        scope.spawn(move || {
            for count in 1000..2000 {
                producer.publish("j", "s", &snapshot(count, false));
            }
        });
        slot.close();
    });
    assert!(slot.latest("j", "s").is_none());
    assert!(!slot.publish("j", "s", &snapshot(3000, true)));
    assert!(LatestScanProgress::new("../private", "s").is_err());
    assert!(LatestScanProgress::new("j", &"x".repeat(65)).is_err());
}
#[test]
fn actual_directory_callback_produces_bound_path_free_final_snapshot() {
    use sentinel_scan::pipeline::{DirectoryLimits, ScanLimits, scan_directory_with_progress};
    use std::fs;
    let dir = std::env::temp_dir().join(format!(
        "sentinel-slot-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir(&dir).unwrap();
    fs::write(dir.join("private-one.txt"), b"one").unwrap();
    fs::write(dir.join("private-two.txt"), b"two").unwrap();
    let slot = LatestScanProgress::new("j", "s").unwrap();
    let report = scan_directory_with_progress(
        &dir,
        ScanLimits::default(),
        DirectoryLimits::default(),
        || false,
        |p| {
            assert!(slot.publish("j", "s", p));
        },
    );
    let bound = slot.latest("j", "s").unwrap();
    assert_eq!(bound.progress.files_checked, report.files_checked);
    assert_eq!(bound.progress.bytes_read, 6);
    let json = serde_json::to_string(&bound).unwrap();
    assert!(json.len() < 1024);
    assert!(!json.contains("private-"));
    assert!(json.contains("\"bytesRead\":\"6\""));
    fs::remove_dir_all(dir).unwrap();
}
