//! Optional benign-file evaluation adapter, not enabled for hostile input.
//! Caller must authenticate/pin engine + database and supply trusted native intent.
use sentinel_proto::assessment::Coverage;
use sentinel_proto::clamav::{ClamAvReport, ClamAvState};
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
    mpsc,
};
use std::time::{Duration, Instant};

const MAX_OUTPUT: u64 = 32_768;
const MAX_FILE: u64 = 8 * 1024 * 1024;
static ACTIVE: AtomicBool = AtomicBool::new(false);
struct Admission;
struct ChildGuard(Child);
impl std::ops::Deref for ChildGuard {
    type Target = Child;
    fn deref(&self) -> &Child {
        &self.0
    }
}
impl std::ops::DerefMut for ChildGuard {
    fn deref_mut(&mut self) -> &mut Child {
        &mut self.0
    }
}
impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
impl Drop for Admission {
    fn drop(&mut self) {
        ACTIVE.store(false, Ordering::Release);
    }
}
fn report(state: ClamAvState) -> ClamAvReport {
    let coverage = match state {
        ClamAvState::NoKnownFinding
        | ClamAvState::SignatureMatch
        | ClamAvState::InspectionIncomplete => Coverage::Partial,
        _ => Coverage::Unavailable,
    };
    ClamAvReport { state, coverage }
}

/// Strict parser for pinned clamscan stdin output with --no-summary --stdout.
/// Signature names/output are never returned. A match is evidence, not proof of malware.
pub fn interpret_result(exit: Option<i32>, output: &[u8]) -> ClamAvReport {
    let failed = || report(ClamAvState::Failed);
    if output.len() as u64 > MAX_OUTPUT {
        return failed();
    }
    let Ok(text) = std::str::from_utf8(output) else {
        return failed();
    };
    let lines: Vec<_> = text.lines().collect();
    if lines.len() != 1 {
        return failed();
    }
    if exit == Some(0) && lines[0] == "stdin: OK" {
        return report(ClamAvState::NoKnownFinding);
    }
    if exit != Some(1) {
        return failed();
    }
    let Some(name) = lines[0]
        .strip_prefix("stdin: ")
        .and_then(|v| v.strip_suffix(" FOUND"))
    else {
        return failed();
    };
    if name.is_empty()
        || name.len() > 256
        || !name
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"._-".contains(&c))
    {
        return failed();
    }
    if name.starts_with("Heuristics.Limits.Exceeded") || name.starts_with("Heuristics.Encrypted.") {
        return report(ClamAvState::InspectionIncomplete);
    }
    report(ClamAvState::SignatureMatch)
}

/// Read-only explicit benign selected-file scan. Engine/database are native configuration,
/// never browser/UI arguments. No engine discovery, update, upload, or remediation.
/// Separate process is NOT a sandbox: hostile parser use awaits reviewed confinement.
pub fn scan_benign_file(
    selected: &Path,
    executable: &Path,
    database: &Path,
    timeout: Duration,
    mut cancelled: impl FnMut() -> bool,
) -> ClamAvReport {
    if !executable.is_absolute()
        || !database.is_absolute()
        || timeout.is_zero()
        || timeout > Duration::from_secs(120)
    {
        return report(ClamAvState::Unavailable);
    }
    if cancelled() {
        return report(ClamAvState::Cancelled);
    }
    if ACTIVE
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return report(ClamAvState::Busy);
    }
    let admission = Arc::new(Admission);
    let Ok(initial) = std::fs::symlink_metadata(selected) else {
        return report(ClamAvState::Unavailable);
    };
    if !initial.is_file()
        || crate::pipeline::is_reparse_point(&initial)
        || initial.len() == 0
        || initial.len() > MAX_FILE
    {
        return report(ClamAvState::InspectionIncomplete);
    }
    let Ok(file) = crate::pipeline::open_read_only_no_follow(selected) else {
        return report(ClamAvState::Unavailable);
    };
    let Ok(opened) = file.metadata() else {
        return report(ClamAvState::Unavailable);
    };
    if !crate::pipeline::same_basic_identity(&initial, &opened)
        || crate::pipeline::is_reparse_point(&opened)
    {
        return report(ClamAvState::SourceChanged);
    }
    // Never hand a growing source directly to clamscan's stdin temp-file copier.
    let mut snapshot = Vec::new();
    if (&file)
        .take(MAX_FILE + 1)
        .read_to_end(&mut snapshot)
        .is_err()
    {
        return report(ClamAvState::Unavailable);
    }
    if snapshot.len() as u64 != opened.len()
        || !file
            .metadata()
            .is_ok_and(|last| crate::pipeline::same_basic_identity(&opened, &last))
    {
        return report(ClamAvState::SourceChanged);
    }
    let mut command = Command::new(executable);
    command
        .arg("--database")
        .arg(database)
        .args([
            "--no-summary",
            "--stdout",
            "--max-filesize=8M",
            "--max-scansize=16M",
            "--max-files=128",
            "--max-recursion=4",
            "--max-scantime=10000",
            "--alert-exceeds-max=yes",
            "--alert-encrypted=yes",
            "--bytecode=no",
            "-",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let Ok(child) = command.spawn() else {
        return report(ClamAvState::Unavailable);
    };
    let mut child = ChildGuard(child);
    let Some(mut stdin) = child.stdin.take() else {
        let _ = child.kill();
        let _ = child.wait();
        return report(ClamAvState::Failed);
    };
    let writer_admission = Arc::clone(&admission);
    let (writer_tx, writer_rx) = mpsc::sync_channel(1);
    if std::thread::Builder::new()
        .name("clamav-bounded-input".into())
        .spawn(move || {
            let _guard = writer_admission;
            let ok = stdin.write_all(&snapshot).is_ok();
            drop(stdin);
            let _ = writer_tx.send(ok);
        })
        .is_err()
    {
        let _ = child.kill();
        let _ = child.wait();
        return report(ClamAvState::Failed);
    }
    let Some(stdout) = child.stdout.take() else {
        let _ = child.kill();
        let _ = child.wait();
        return report(ClamAvState::Failed);
    };
    let (tx, rx) = mpsc::sync_channel(1);
    let reader_admission = Arc::clone(&admission);
    let reader = std::thread::Builder::new()
        .name("clamav-bounded-output".into())
        .spawn(move || {
            let _guard = reader_admission;
            let mut bytes = Vec::new();
            let result = stdout.take(MAX_OUTPUT + 1).read_to_end(&mut bytes);
            let _ = tx.send(if result.is_ok() && bytes.len() as u64 <= MAX_OUTPUT {
                Some(bytes)
            } else {
                None
            });
        });
    if reader.is_err() {
        let _ = child.kill();
        let _ = child.wait();
        return report(ClamAvState::Failed);
    }
    let start = Instant::now();
    let mut output = None;
    let mut input_complete = false;
    loop {
        let failure = if cancelled() {
            Some(ClamAvState::Cancelled)
        } else if start.elapsed() >= timeout {
            Some(ClamAvState::TimedOut)
        } else {
            None
        };
        if let Some(state) = failure {
            let _ = child.kill();
            let _ = child.wait();
            return report(state);
        }
        if !input_complete {
            match writer_rx.try_recv() {
                Ok(true) => input_complete = true,
                Ok(false) | Err(mpsc::TryRecvError::Disconnected) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return report(ClamAvState::Failed);
                }
                Err(mpsc::TryRecvError::Empty) => {}
            }
        }
        if output.is_none() {
            match rx.try_recv() {
                Ok(Some(bytes)) => output = Some(bytes),
                Ok(None) | Err(mpsc::TryRecvError::Disconnected) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return report(ClamAvState::Failed);
                }
                Err(mpsc::TryRecvError::Empty) => {}
            }
        }
        match child.try_wait() {
            Ok(Some(status)) if output.is_some() && input_complete => {
                if !file
                    .metadata()
                    .is_ok_and(|last| crate::pipeline::same_basic_identity(&opened, &last))
                {
                    return report(ClamAvState::SourceChanged);
                }
                return interpret_result(status.code(), output.as_ref().unwrap());
            }
            Ok(_) => {}
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return report(ClamAvState::Failed);
            }
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}
