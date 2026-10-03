use sentinel_proto::scan_report::LocalScanControlState;
use sentinel_scan::{
    control::LocalScanControl,
    pipeline::{ScanLimits, ScanState, scan_file_with_cancel},
};
use std::time::Duration;

#[test]
fn cancelled_clone_stops_before_invalid_path_access_and_remains_sticky() {
    let control = LocalScanControl::new(Duration::from_secs(1)).unwrap();
    control.clone().request_cancel();
    let report = scan_file_with_cancel("never-accessed", ScanLimits::default(), &mut || {
        control.should_stop()
    });
    assert_eq!(report.state, ScanState::Cancelled);
    assert_eq!(report.access_errors, 0);
    assert_eq!(report.bytes_read, 0);
    assert_eq!(control.finish(), LocalScanControlState::Cancelled);
    assert!(control.should_stop());
    assert_eq!(control.finish(), LocalScanControlState::Cancelled);
}
#[test]
fn elapsed_monotonic_deadline_is_distinct_from_manual_cancel() {
    let control = LocalScanControl::new(Duration::from_millis(1)).unwrap();
    std::thread::sleep(Duration::from_millis(3));
    let report = scan_file_with_cancel("never-accessed", ScanLimits::default(), &mut || {
        control.should_stop()
    });
    assert_eq!(report.state, ScanState::Cancelled);
    assert_eq!(report.access_errors, 0);
    control.request_cancel();
    assert_eq!(control.finish(), LocalScanControlState::TimedOut);
    assert_eq!(serde_json::to_value(control.state()).unwrap(), "timed_out");
}
#[test]
fn completed_return_does_not_turn_into_cancel_or_timeout_later() {
    let control = LocalScanControl::new(Duration::from_secs(1)).unwrap();
    let report = scan_file_with_cancel(
        "nonexistent-selected-file",
        ScanLimits::default(),
        &mut || control.should_stop(),
    );
    assert_eq!(report.state, ScanState::AccessError);
    assert_eq!(control.finish(), LocalScanControlState::Returned);
    control.request_cancel();
    assert_eq!(control.finish(), LocalScanControlState::Returned);
    assert!(!control.should_stop());
}
#[test]
fn deadline_configuration_is_bounded_and_errors_do_not_echo() {
    for deadline in [
        Duration::ZERO,
        Duration::from_nanos(1),
        Duration::from_secs(301),
    ] {
        let err = LocalScanControl::new(deadline).err().unwrap();
        assert_eq!(err.to_string(), "invalid local scan deadline");
    }
    assert!(LocalScanControl::new(Duration::from_millis(1)).is_ok());
    assert!(LocalScanControl::new(Duration::from_secs(300)).is_ok());
}
#[test]
fn cloned_control_stops_actual_benign_read_without_checked_hash() {
    use std::fs;
    let path = std::env::temp_dir().join(format!(
        "sentinel-control-{}-{}.txt",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::write(&path, vec![b'a'; 20000]).unwrap();
    let control = LocalScanControl::new(Duration::from_secs(300)).unwrap();
    let sender = control.clone();
    let mut polls = 0;
    let report = scan_file_with_cancel(&path, ScanLimits::default(), &mut || {
        polls += 1;
        if polls == 3 {
            sender.request_cancel();
        }
        control.should_stop()
    });
    assert_eq!(control.finish(), LocalScanControlState::Cancelled);
    assert_eq!(report.bytes_read, 8192);
    assert_eq!(report.files_checked, 0);
    assert_eq!(report.sha256, None);
    let retry = LocalScanControl::new(Duration::from_secs(300)).unwrap();
    let result = scan_file_with_cancel(&path, ScanLimits::default(), &mut || retry.should_stop());
    assert_eq!(retry.finish(), LocalScanControlState::Returned);
    assert_eq!(result.files_checked, 1);
    assert_eq!(result.bytes_read, 20000);
    fs::remove_file(path).unwrap();
}
#[test]
fn stop_request_is_not_scanner_return_and_concurrent_finish_state_is_frozen() {
    use std::sync::Barrier;
    for _ in 0..32 {
        let control = LocalScanControl::new(Duration::from_secs(300)).unwrap();
        assert!(!control.has_returned());
        let barrier = Barrier::new(2);
        let state = std::thread::scope(|scope| {
            let sender = control.clone();
            let sync = &barrier;
            scope.spawn(move || {
                sync.wait();
                sender.request_cancel();
            });
            barrier.wait();
            control.finish()
        });
        assert!(control.has_returned());
        assert!(matches!(
            state,
            LocalScanControlState::Returned | LocalScanControlState::Cancelled
        ));
        assert_eq!(control.state(), state);
        control.request_cancel();
        assert_eq!(control.finish(), state);
    }
    let stopped = LocalScanControl::new(Duration::from_secs(300)).unwrap();
    stopped.request_cancel();
    assert!(!stopped.has_returned());
    assert_eq!(stopped.state(), LocalScanControlState::Cancelled);
    stopped.finish();
    assert!(stopped.has_returned());
}
