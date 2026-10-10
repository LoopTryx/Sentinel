//! Private inherited-pipe session. Confirm operations may be sent ONLY by a
//! trusted native parent after its own explicit OS consent dialog. No HTTP/IPC
//! caller, browser approval boolean or arbitrary restore destination is accepted.
use sentinel_av::{scan_jobs::SelectedJobs, vault::Vault};
use sentinel_proto::selected_scan::ScanWorkerState;
use sentinel_proto::{quarantine_action as quarantine, restore_action as restore};
use serde::Deserialize;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::mpsc::{sync_channel, TryRecvError};
use std::time::{Duration, Instant};

#[derive(Deserialize)]
#[serde(
    tag = "op",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum Command {
    Cancel,
    Close,
    PrepareQuarantine { report_ref: String },
    ConfirmQuarantine { action_ref: String },
    DeclineQuarantine { action_ref: String },
    PrepareRestore { quarantine_action_ref: String },
    ConfirmRestore { restore_ref: String },
    DeclineRestore { restore_ref: String },
}

fn emit(output: &mut impl Write, kind: &str, data: impl serde::Serialize) -> Result<(), ()> {
    serde_json::to_writer(&mut *output, &serde_json::json!({"type":kind,"data":data}))
        .map_err(|_| ())?;
    writeln!(output).map_err(|_| ())?;
    output.flush().map_err(|_| ())
}

fn response<T: serde::Serialize>(
    output: &mut impl Write,
    kind: &str,
    result: Result<T, quarantine::QuarantineError>,
) -> Result<(), ()> {
    match result {
        Ok(value) => emit(output, kind, value),
        Err(error) => emit(output, "error", error),
    }
}

pub(super) fn run(
    mut jobs: SelectedJobs,
    owner: &str,
    job: String,
    root: PathBuf,
) -> Result<(), ()> {
    let label = root.to_string_lossy();
    if !root.is_absolute()
        || label.len() > 2048
        || label.to_ascii_lowercase().starts_with("e:")
        || label.starts_with("\\\\")
    {
        return Err(());
    }
    let vault = Vault::new(&root);
    let (sender, receiver) = sync_channel::<Result<Command, ()>>(4);
    std::thread::spawn(move || {
        let mut input = std::io::stdin().lock();
        for _ in 0..64 {
            let mut bytes = Vec::with_capacity(128);
            loop {
                let mut byte = [0];
                match input.read(&mut byte) {
                    Ok(1) => {
                        bytes.push(byte[0]);
                        if byte[0] == b'\n' {
                            break;
                        }
                        if bytes.len() > 1024 {
                            let _ = sender.send(Err(()));
                            return;
                        }
                    }
                    _ => {
                        let _ = sender.send(Ok(Command::Close));
                        return;
                    }
                }
            }
            let value = serde_json::from_slice::<Command>(&bytes).map_err(|_| ());
            let invalid = value.is_err();
            if sender.send(value).is_err() || invalid {
                return;
            }
        }
        let _ = sender.send(Err(()));
    });
    let started = Instant::now();
    let mut output = std::io::stdout().lock();
    let mut previous = String::new();
    let mut closing = false;
    loop {
        jobs.maintain(Instant::now());
        let snapshot = jobs.poll_wire(owner, &job).map_err(|_| ())?;
        let finished = snapshot.state != ScanWorkerState::Running;
        if closing && finished {
            return Ok(());
        }
        let line = serde_json::to_string(&snapshot).map_err(|_| ())?;
        if line != previous {
            emit(&mut output, "scan", &snapshot)?;
            previous = line;
        }
        if started.elapsed() >= Duration::from_secs(300) {
            closing = true;
            jobs.cancel(owner, &job).map_err(|_| ())?;
        }
        match receiver.try_recv() {
            Ok(Ok(Command::Close)) | Err(TryRecvError::Disconnected) => {
                closing = true;
                if !finished {
                    jobs.cancel(owner, &job).map_err(|_| ())?;
                }
            }
            Ok(Err(())) => {
                emit(
                    &mut output,
                    "error",
                    quarantine::QuarantineError {
                        code: quarantine::QuarantineErrorCode::InvalidRequest,
                    },
                )?;
                closing = true;
                jobs.cancel(owner, &job).map_err(|_| ())?;
            }
            Ok(Ok(Command::Cancel)) => {
                jobs.cancel(owner, &job).map_err(|_| ())?;
            }
            Ok(Ok(Command::PrepareQuarantine { report_ref })) => response(
                &mut output,
                "quarantine_preview",
                jobs.prepare_quarantine(
                    owner,
                    &quarantine::QuarantinePrepareRequest {
                        job_ref: job.clone(),
                        report_ref,
                    },
                    Instant::now(),
                ),
            )?,
            Ok(Ok(
                command @ (Command::ConfirmQuarantine { .. } | Command::DeclineQuarantine { .. }),
            )) => {
                let (action_ref, approved) = match command {
                    Command::ConfirmQuarantine { action_ref } => (action_ref, true),
                    Command::DeclineQuarantine { action_ref } => (action_ref, false),
                    _ => unreachable!(),
                };
                response(
                    &mut output,
                    "quarantine_receipt",
                    jobs.quarantine_after_native_confirmation(
                        owner,
                        &quarantine::QuarantineActionReference { action_ref },
                        Instant::now(),
                        &vault,
                        approved,
                    ),
                )?;
            }
            Ok(Ok(Command::PrepareRestore {
                quarantine_action_ref,
            })) => response(
                &mut output,
                "restore_preview",
                jobs.prepare_restore(
                    owner,
                    &restore::RestorePrepareRequest {
                        quarantine_action_ref,
                    },
                    Instant::now(),
                ),
            )?,
            Ok(Ok(command @ (Command::ConfirmRestore { .. } | Command::DeclineRestore { .. }))) => {
                let (restore_ref, approved) = match command {
                    Command::ConfirmRestore { restore_ref } => (restore_ref, true),
                    Command::DeclineRestore { restore_ref } => (restore_ref, false),
                    _ => unreachable!(),
                };
                response(
                    &mut output,
                    "restore_receipt",
                    jobs.restore_after_native_confirmation(
                        owner,
                        &restore::RestoreActionReference { restore_ref },
                        Instant::now(),
                        &vault,
                        approved,
                    ),
                )?;
            }
            Err(TryRecvError::Empty) => {}
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}
