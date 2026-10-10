//! Native-parent scan transport. No listener, browser requests or remediation.
//! Process separation is NOT restricted-token/network-denied isolation.
use sentinel_av::scan_jobs::{SelectedJobs, SelectionKind};
use sentinel_proto::selected_scan::ScanWorkerState;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

#[path = "sentinel-inspect/session.rs"]
mod session;

fn run() -> Result<(), ()> {
    let mut args = std::env::args_os().skip(1);
    let kind = match args
        .next()
        .and_then(|arg| arg.into_string().ok())
        .as_deref()
    {
        Some("--file") => SelectionKind::File,
        Some("--folder") => SelectionKind::Directory,
        _ => return Err(()),
    };
    let path = args.next().ok_or(())?;
    let session_root = match args.next() {
        None => None,
        Some(flag) if flag == "--session" => Some(std::path::PathBuf::from(args.next().ok_or(())?)),
        _ => return Err(()),
    };
    if args.next().is_some() {
        return Err(());
    }
    // This identity is scoped to this owned process, not cross-client auth.
    let owner = "owned-native-parent";
    let mut jobs = SelectedJobs::default();
    let selection = jobs
        .select(owner, path.into(), kind, Instant::now())
        .map_err(|_| ())?;
    let job = jobs
        .start(owner, &selection, Instant::now())
        .map_err(|_| ())?;
    if let Some(root) = session_root {
        return session::run(jobs, owner, job, root);
    }
    let cancelled = Arc::new(AtomicBool::new(false));
    let input_cancelled = cancelled.clone();
    std::thread::spawn(move || {
        let mut input = std::io::stdin().lock();
        let mut command = Vec::with_capacity(16);
        for _ in 0..16 {
            let mut byte = [0];
            match input.read(&mut byte) {
                Ok(1) => {
                    command.push(byte[0]);
                    if byte[0] == b'\n' {
                        break;
                    }
                }
                _ => return,
            }
        }
        // Malformed or oversized commands fail closed by requesting cancel.
        input_cancelled.store(!command.is_empty(), Ordering::Release);
    });
    let mut output = std::io::stdout().lock();
    let mut previous = String::new();
    loop {
        if cancelled.load(Ordering::Acquire) {
            jobs.cancel(owner, &job).map_err(|_| ())?;
        }
        let snapshot = jobs.poll_wire(owner, &job).map_err(|_| ())?;
        let finished = snapshot.state != ScanWorkerState::Running;
        let line = serde_json::to_string(&snapshot).map_err(|_| ())?;
        if line != previous {
            writeln!(output, "{line}").map_err(|_| ())?;
            output.flush().map_err(|_| ())?;
            previous = line;
        }
        if finished {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

fn main() {
    if run().is_err() {
        println!("{{\"error\":\"inspection_unavailable\"}}");
        std::process::exit(1);
    }
}
