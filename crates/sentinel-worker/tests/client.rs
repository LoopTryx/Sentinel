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
#[cfg(windows)]
fn worker_cannot_spawn_children_or_exceed_memory_limit() {
    for marker in *b"JM" {
        let path = fixture_path(&format!("resource-{marker}"));
        fs::write(&path, [marker]).unwrap();
        // Establish that the probe succeeds without the launcher's limits.
        use std::os::windows::process::CommandExt;
        let unrestricted = std::process::Command::new(env!("CARGO_BIN_EXE_fixture-worker"))
            .stdin(fs::File::open(&path).unwrap())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(0x08000000)
            .status()
            .unwrap();
        assert_eq!(unrestricted.code(), Some(7));
        let report = scan_file_via_worker(
            &path,
            env!("CARGO_BIN_EXE_fixture-worker"),
            Duration::from_secs(5),
        )
        .unwrap();
        assert_eq!(report.state, ScanState::NoKnownFinding);
        fs::remove_file(path).unwrap();
    }
}

#[test]
fn missing_executable_fails_without_fallback() {
    let path = fixture_path("missing-worker-source");
    fs::write(&path, b"benign").unwrap();
    let missing = fixture_path("missing-worker.exe");
    assert_eq!(
        scan_file_via_worker(&path, missing, Duration::from_secs(1)).unwrap_err(),
        WorkerScanError::LaunchFailed
    );
    fs::remove_file(path).unwrap();
}

#[test]
#[cfg(windows)]
fn unrelated_inheritable_handle_is_excluded() {
    use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
    use std::os::windows::process::CommandExt;
    use windows_sys::Win32::Foundation::{WAIT_OBJECT_0, WAIT_TIMEOUT};
    use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
    use windows_sys::Win32::System::Threading::{CreateEventW, ResetEvent, WaitForSingleObject};
    let security = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: std::ptr::null_mut(),
        bInheritHandle: 1,
    };
    // SAFETY: valid security attributes; private manual-reset test event.
    let raw = unsafe { CreateEventW(&security, 1, 0, std::ptr::null()) };
    assert!(!raw.is_null());
    // SAFETY: unique ownership of the successfully created event.
    let event = unsafe { OwnedHandle::from_raw_handle(raw) };
    let path = fixture_path("handle-allowlist");
    let mut bytes = vec![b'A'];
    bytes.extend_from_slice(&(event.as_raw_handle() as usize as u64).to_le_bytes());
    fs::write(&path, bytes).unwrap();
    let status = std::process::Command::new(env!("CARGO_BIN_EXE_fixture-worker"))
        .stdin(fs::File::open(&path).unwrap())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .creation_flags(0x08000000)
        .status()
        .unwrap();
    assert!(status.success());
    // SAFETY: event remains owned and valid throughout these checks.
    unsafe {
        assert_eq!(WaitForSingleObject(raw, 0), WAIT_OBJECT_0);
        assert_ne!(ResetEvent(raw), 0);
    }
    assert_eq!(
        scan_file_via_worker(
            &path,
            env!("CARGO_BIN_EXE_fixture-worker"),
            Duration::from_secs(5)
        )
        .unwrap_err(),
        WorkerScanError::InvalidResponse
    );
    // SAFETY: observing the same owned event proves it was not inherited.
    assert_eq!(unsafe { WaitForSingleObject(raw, 0) }, WAIT_TIMEOUT);
    fs::remove_file(path).unwrap();
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

#[test]
#[cfg(windows)]
fn saturated_and_endless_output_are_rejected_before_deadline() {
    for marker in *b"OELBT" {
        let path = fixture_path(&format!("output-{marker}"));
        fs::write(&path, [marker]).unwrap();
        let started = std::time::Instant::now();
        let result = scan_file_via_worker(
            &path,
            env!("CARGO_BIN_EXE_fixture-worker"),
            Duration::from_secs(5),
        );
        assert_eq!(result.unwrap_err(), WorkerScanError::InvalidResponse);
        assert!(started.elapsed() < Duration::from_secs(3));
        // The worker's inherited source handle must be released before return.
        fs::remove_file(path).unwrap();
    }
}

#[test]
#[cfg(windows)]
fn valid_response_larger_than_pipe_capacity_is_drained_while_running() {
    let path = fixture_path("large-valid");
    fs::write(&path, b"V").unwrap();
    let report = scan_file_via_worker(
        &path,
        env!("CARGO_BIN_EXE_fixture-worker"),
        Duration::from_secs(5),
    )
    .unwrap();
    assert_eq!(report.state, ScanState::NoKnownFinding);
    assert_eq!(report.files_checked, 1);
    assert_eq!(report.bytes_read, 1);
    fs::remove_file(path).unwrap();
}

#[test]
#[cfg(windows)]
fn valid_frame_without_process_exit_still_times_out() {
    let path = fixture_path("frame-no-exit");
    fs::write(&path, b"P").unwrap();
    let started = std::time::Instant::now();
    let result = scan_file_via_worker(
        &path,
        env!("CARGO_BIN_EXE_fixture-worker"),
        Duration::from_millis(500),
    );
    assert_eq!(result.unwrap_err(), WorkerScanError::TimedOut);
    assert!(started.elapsed() < Duration::from_secs(3));
    fs::remove_file(path).unwrap();
}
