use crate::pipeline::{ScanResult, ScanState};
use sentinel_proto::rpc::{ProtocolVersion, decode_frame};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
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
    WorkerFailed,
    InvalidResponse,
}

/// Gives the worker a duplicated, read-only file handle as stdin. The worker
/// has no path argument. This is process separation, not a restricted token.
pub fn scan_file_via_worker(
    path: impl AsRef<Path>,
    worker_executable: impl AsRef<Path>,
    timeout: Duration,
) -> Result<ScanResult, WorkerScanError> {
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
    let mut child = Command::new(worker_executable.as_ref())
        .arg("--scan-stdin")
        .stdin(Stdio::from(child_stdin))
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| WorkerScanError::LaunchFailed)?;
    let start = Instant::now();
    let status = loop {
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
    Ok(response.report)
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
