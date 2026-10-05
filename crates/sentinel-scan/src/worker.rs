use crate::pipeline::{ScanResult, ScanState};
#[cfg(windows)]
use crate::worker_windows::WorkerChild as Child;
use sentinel_proto::rpc::{ProtocolVersion, decode_frame};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;
#[cfg(not(windows))]
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

pub const WORKER_PROTOCOL: ProtocolVersion = ProtocolVersion::new(1, 0);
const MAX_WORKER_OUTPUT_BYTES: u64 = 1_048_580;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorkerResponse {
    pub version: ProtocolVersion,
    pub report: ScanResult,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WorkerScanError {
    SourceUnavailable,
    SourceUnsupported,
    SourceChanged,
    LaunchFailed,
    TimedOut,
    Cancelled,
    WorkerFailed,
    InvalidResponse,
    CleanupFailed,
}

/// Gives the worker a duplicated, read-only file handle as stdin. The worker
/// has no path argument. This is process separation, not a restricted token.
pub fn scan_file_via_worker(
    path: impl AsRef<Path>,
    worker_executable: impl AsRef<Path>,
    timeout: Duration,
) -> Result<ScanResult, WorkerScanError> {
    scan_file_via_worker_cancellable(path, worker_executable, timeout, || false)
}

/// Cooperative native cancellation, before access/launch and during collection.
/// Windows cancellation terminates/reaps the invocation's owned Job Object;
/// cleanup failure remains distinct and no cancelled result counts as checked.
pub fn scan_file_via_worker_cancellable(
    path: impl AsRef<Path>,
    worker_executable: impl AsRef<Path>,
    timeout: Duration,
    mut cancelled: impl FnMut() -> bool,
) -> Result<ScanResult, WorkerScanError> {
    let start = Instant::now();
    checkpoint(start, timeout, &mut cancelled)?;
    let path = path.as_ref();
    let initial = fs::symlink_metadata(path).map_err(|_| WorkerScanError::SourceUnavailable)?;
    if !initial.is_file() || crate::pipeline::is_reparse_point(&initial) {
        return Err(WorkerScanError::SourceUnsupported);
    }
    let file = crate::pipeline::open_read_only_no_follow(path)
        .map_err(|_| WorkerScanError::SourceUnavailable)?;
    let opened = file
        .metadata()
        .map_err(|_| WorkerScanError::SourceUnavailable)?;
    if !opened.is_file() || crate::pipeline::is_reparse_point(&opened) {
        return Err(WorkerScanError::SourceUnsupported);
    }
    if !crate::pipeline::same_basic_identity(&initial, &opened) {
        return Err(WorkerScanError::SourceChanged);
    }
    let child_stdin = file
        .try_clone()
        .map_err(|_| WorkerScanError::SourceUnavailable)?;
    checkpoint(start, timeout, &mut cancelled)?;
    #[cfg(windows)]
    let mut child = Child::spawn(worker_executable.as_ref(), &child_stdin)
        .map_err(|_| WorkerScanError::LaunchFailed)?;
    #[cfg(not(windows))]
    let mut child = Command::new(worker_executable.as_ref())
        .arg("--scan-stdin")
        .stdin(Stdio::from(child_stdin))
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| WorkerScanError::LaunchFailed)?;
    let output = match collect_output(&mut child, start, timeout, &mut cancelled) {
        Ok(output) => output,
        Err(error) => {
            let _ = child.kill();
            #[cfg(windows)]
            if child.wait().is_err() {
                return Err(WorkerScanError::CleanupFailed);
            }
            #[cfg(not(windows))]
            let _ = child.wait();
            return Err(error);
        }
    };
    checkpoint(start, timeout, &mut cancelled)?;
    let payload = decode_frame(&output).map_err(|_| WorkerScanError::InvalidResponse)?;
    let response: WorkerResponse =
        serde_json::from_slice(payload).map_err(|_| WorkerScanError::InvalidResponse)?;
    if response.version != WORKER_PROTOCOL || !valid_worker_report(&response.report) {
        return Err(WorkerScanError::InvalidResponse);
    }
    let final_metadata = file
        .metadata()
        .map_err(|_| WorkerScanError::SourceUnavailable)?;
    if !crate::pipeline::same_basic_identity(&opened, &final_metadata)
        || (response.report.files_checked == 1 && response.report.bytes_read != opened.len())
    {
        return Err(WorkerScanError::SourceChanged);
    }
    checkpoint(start, timeout, &mut cancelled)?;
    Ok(response.report)
}

// Peek makes reads nonblocking without a reader thread that can be stranded
// by a descendant retaining stdout. The deadline covers exit AND pipe EOF.
#[cfg(windows)]
fn collect_output(
    child: &mut Child,
    start: Instant,
    timeout: Duration,
    cancelled: &mut impl FnMut() -> bool,
) -> Result<Vec<u8>, WorkerScanError> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::ERROR_BROKEN_PIPE;
    use windows_sys::Win32::System::Pipes::PeekNamedPipe;

    let mut stdout = child
        .stdout
        .take()
        .ok_or(WorkerScanError::InvalidResponse)?;
    let mut output = Vec::new();
    let mut chunk = [0u8; 8192];
    let mut expected = None;
    let mut status = None;
    loop {
        checkpoint(start, timeout, cancelled)?;
        if status.is_none() {
            status = child
                .try_wait()
                .map_err(|_| WorkerScanError::WorkerFailed)?;
        }
        if status.is_some_and(|status| !status.success()) {
            return Err(WorkerScanError::WorkerFailed);
        }
        let mut available = 0;
        // SAFETY: stdout owns a live pipe handle; only `available` is written.
        let peek = unsafe {
            PeekNamedPipe(
                stdout.as_raw_handle(),
                std::ptr::null_mut(),
                0,
                std::ptr::null_mut(),
                &mut available,
                std::ptr::null_mut(),
            )
        };
        if peek == 0 {
            if std::io::Error::last_os_error().raw_os_error() != Some(ERROR_BROKEN_PIPE as i32) {
                return Err(WorkerScanError::InvalidResponse);
            }
            if status.is_some() {
                return Ok(output);
            }
        } else if available > 0 {
            // Read the header alone before allocating for any declared payload.
            let wanted = if output.len() < 4 {
                4 - output.len()
            } else {
                chunk.len()
            };
            let wanted = wanted.min(available as usize);
            let count = stdout
                .read(&mut chunk[..wanted])
                .map_err(|_| WorkerScanError::InvalidResponse)?;
            if count == 0 || output.len() + count > MAX_WORKER_OUTPUT_BYTES as usize {
                return Err(WorkerScanError::InvalidResponse);
            }
            output.extend_from_slice(&chunk[..count]);
            if output.len() == 4 && expected.is_none() {
                let length = u32::from_be_bytes(output[..4].try_into().unwrap()) as usize;
                if length > sentinel_proto::rpc::MAX_MESSAGE_BYTES {
                    return Err(WorkerScanError::InvalidResponse);
                }
                expected = Some(4 + length);
            }
            if expected.is_some_and(|length| output.len() > length) {
                return Err(WorkerScanError::InvalidResponse);
            }
            continue;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}

// Non-Windows development fallback retains the original exit-first behavior.
// The supported production platform and saturation acceptance are Windows.
#[cfg(not(windows))]
fn collect_output(
    child: &mut Child,
    start: Instant,
    timeout: Duration,
    cancelled: &mut impl FnMut() -> bool,
) -> Result<Vec<u8>, WorkerScanError> {
    let status = loop {
        checkpoint(start, timeout, cancelled)?;
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if start.elapsed() < timeout => std::thread::sleep(Duration::from_millis(10)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(WorkerScanError::TimedOut);
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(WorkerScanError::WorkerFailed);
            }
        }
    };
    if !status.success() {
        return Err(WorkerScanError::WorkerFailed);
    }
    let mut output = Vec::new();
    child
        .stdout
        .take()
        .ok_or(WorkerScanError::InvalidResponse)?
        .take(MAX_WORKER_OUTPUT_BYTES + 1)
        .read_to_end(&mut output)
        .map_err(|_| WorkerScanError::InvalidResponse)?;
    if output.len() as u64 > MAX_WORKER_OUTPUT_BYTES {
        return Err(WorkerScanError::InvalidResponse);
    }
    Ok(output)
}

fn checkpoint(
    start: Instant,
    timeout: Duration,
    cancelled: &mut impl FnMut() -> bool,
) -> Result<(), WorkerScanError> {
    if cancelled() {
        Err(WorkerScanError::Cancelled)
    } else if start.elapsed() >= timeout {
        Err(WorkerScanError::TimedOut)
    } else {
        Ok(())
    }
}
fn valid_worker_report(report: &ScanResult) -> bool {
    if report.files_visited != 1
        || report.engine_failures != 0
        || report.full_signature_engine_active
        || report.bytes_read > 512 * 1024 * 1024 + 8192
    {
        return false;
    }
    match report.state {
        ScanState::NoKnownFinding | ScanState::TestSignatureFound => {
            report.files_checked == 1
                && report.files_skipped == 0
                && report.access_errors == 0
                && report.sha256.as_ref().is_some_and(|hash| {
                    hash.len() == 64 && hash.bytes().all(|byte| byte.is_ascii_hexdigit())
                })
        }
        ScanState::SkippedLimit => {
            report.files_checked == 0
                && report.files_skipped == 1
                && report.access_errors == 0
                && report.sha256.is_none()
        }
        ScanState::AccessError => {
            report.files_checked == 0
                && report.files_skipped == 0
                && report.access_errors == 1
                && report.sha256.is_none()
        }
        _ => false,
    }
}
