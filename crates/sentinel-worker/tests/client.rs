use sentinel_scan::pipeline::ScanState;
use sentinel_scan::worker::{WorkerScanError, scan_file_via_worker};
use std::fs;
use std::time::Duration;

fn fixture_path(name: &str) -> std::path::PathBuf {
    let path =
        std::env::temp_dir().join(format!("sentinel-worker-{}-{name}.txt", std::process::id()));
    let _ = fs::remove_file(&path);
    path
}

#[test]
fn approved_file_handle_reaches_worker_without_path_argument() {
    let path = fixture_path("good");
    fs::write(&path, b"benign approved fixture").unwrap();
    let report = scan_file_via_worker(
        &path,
        env!("CARGO_BIN_EXE_sentinel-worker"),
        Duration::from_secs(5),
    )
    .unwrap();
    assert_eq!(report.state, ScanState::NoKnownFinding);
    assert_eq!(report.files_checked, 1);
    assert_eq!(report.bytes_read, 23);
    fs::remove_file(path).unwrap();
}

#[test]
fn worker_crash_and_bad_output_do_not_mark_file_checked() {
    for (name, bytes, expected) in [
        ("crash", b"F".as_slice(), WorkerScanError::WorkerFailed),
        ("bad", b"I".as_slice(), WorkerScanError::InvalidResponse),
    ] {
        let path = fixture_path(name);
        fs::write(&path, bytes).unwrap();
        let result = scan_file_via_worker(
            &path,
            env!("CARGO_BIN_EXE_fixture-worker"),
            Duration::from_secs(5),
        );
        assert!(matches!(result, Err(error) if error == expected));
        fs::remove_file(path).unwrap();
    }
}

#[test]
fn worker_deadline_terminates_hanging_process() {
    let path = fixture_path("hang");
    fs::write(&path, b"H").unwrap();
    let started = std::time::Instant::now();
    let result = scan_file_via_worker(
        &path,
        env!("CARGO_BIN_EXE_fixture-worker"),
        Duration::from_millis(100),
    );
    assert!(matches!(result, Err(WorkerScanError::TimedOut)));
    assert!(started.elapsed() < Duration::from_secs(5));
    fs::remove_file(path).unwrap();
}
