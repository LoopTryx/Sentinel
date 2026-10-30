//! Read-only streaming desktop scans using the existing Sentinel engine.
//! No shell, network, policy changes, or automatic heuristic remediation.
use sentinel_av::engine::Engine;
use serde::Serialize;
use std::{
    io::{self, BufRead, Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    state: String,
    checked: u64,
    skipped: u64,
    findings: u64,
    bytes: u64,
    limited: bool,
    details: Vec<Finding>,
}
#[derive(Serialize)]
struct Finding {
    path: String,
    signals: Vec<String>,
}
fn emit(p: &Progress) -> io::Result<()> {
    let mut out = io::stdout().lock();
    serde_json::to_writer(&mut out, p)?;
    writeln!(out)?;
    out.flush()
}
fn excluded(path: &Path) -> bool {
    let text = path.to_string_lossy();
    text.to_ascii_uppercase().starts_with("E:")
        || text.starts_with(r"\\")
        || path.components().any(|c| {
            matches!(
                c.as_os_str().to_str(),
                Some(".sentinel-vault" | "System Volume Information" | "$Recycle.Bin")
            )
        })
}
fn reparse(m: &std::fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        m.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    {
        m.file_type().is_symlink()
    }
}
fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.is_empty()
        || args.len() > 2
        || args[0] != "--stdin-roots"
        || (args.len() == 2 && args[1] != "--quick")
    {
        return Err("invalid mode".into());
    }
    // Configuration is sent only by the owned native parent, never a renderer path.
    let mut input = io::stdin().lock();
    let mut line = String::new();
    input.by_ref().take(32769).read_line(&mut line)?;
    if line.len() > 32768 {
        return Err("configuration too large".into());
    }
    let roots: Vec<PathBuf> = serde_json::from_str(&line)?;
    if roots.is_empty() || roots.len() > 32 || roots.iter().any(|p| !p.is_absolute() || excluded(p))
    {
        return Err("invalid roots".into());
    }
    drop(input);
    let cancel = Arc::new(AtomicBool::new(false));
    let flag = cancel.clone();
    std::thread::spawn(move || {
        let mut line = String::new();
        let _ = io::stdin().read_line(&mut line);
        flag.store(true, Ordering::Release);
    });
    let engine = Engine::new();
    let mut p = Progress {
        state: "scanning".into(),
        ..Default::default()
    };
    emit(&p)?;
    let deadline =
        Instant::now() + Duration::from_secs(if args.len() == 2 { 120 } else { 4 * 60 * 60 });
    let mut seen = std::collections::HashSet::new();
    let mut last = Instant::now();
    'roots: for root in roots {
        for entry in walkdir::WalkDir::new(root)
            .follow_links(false)
            .max_depth(64)
            .into_iter()
            .filter_entry(|e| {
                !excluded(e.path())
                    && std::fs::symlink_metadata(e.path())
                        .map(|m| !reparse(&m))
                        .unwrap_or(false)
            })
        {
            if cancel.load(Ordering::Acquire) {
                p.state = "cancelled".into();
                break 'roots;
            }
            if Instant::now() >= deadline || p.checked + p.skipped >= 1_000_000 {
                p.limited = true;
                break 'roots;
            }
            let entry = match entry {
                Ok(v) => v,
                Err(_) => {
                    p.skipped += 1;
                    continue;
                }
            };
            let m = match std::fs::symlink_metadata(entry.path()) {
                Ok(v) => v,
                Err(_) => {
                    p.skipped += 1;
                    continue;
                }
            };
            if reparse(&m) {
                p.skipped += 1;
                continue;
            }
            if m.is_dir() && entry.depth() == 64 {
                p.limited = true;
                p.skipped += 1;
            }
            if !m.is_file() {
                continue;
            }
            if !seen.insert(entry.path().to_path_buf()) {
                continue;
            }
            if seen.len() > 1_000_000 {
                p.limited = true;
                break 'roots;
            }
            let report = engine.scan_file_with_control(
                entry.path(),
                &|_| None,
                &mut || cancel.load(Ordering::Acquire),
                &mut |_| {},
                deadline.min(Instant::now() + Duration::from_secs(30)),
            );
            p.bytes += report.bytes_inspected;
            if report.content_complete {
                p.checked += 1;
            } else {
                p.skipped += 1;
            }
            if !report.detections.is_empty() {
                p.findings += 1;
                if p.details.len() < 16 {
                    p.details.push(Finding {
                        path: entry.path().to_string_lossy().chars().take(256).collect(),
                        signals: report
                            .detections
                            .iter()
                            .take(4)
                            .map(|d| d.name.chars().take(64).collect())
                            .collect(),
                    });
                }
            }
            if last.elapsed() >= Duration::from_millis(500) {
                emit(&p)?;
                last = Instant::now();
            }
        }
    }
    if p.state != "cancelled" {
        p.state = if p.limited || p.skipped > 0 {
            "incomplete"
        } else {
            "completed"
        }
        .into();
    }
    emit(&p)?;
    Ok(())
}
fn main() {
    if run().is_err() {
        eprintln!("Sentinel scan unavailable");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn protected_paths_are_excluded() {
        assert!(excluded(Path::new(r"E:\private")));
        assert!(excluded(Path::new(r"\\server\share")));
        assert!(!excluded(Path::new(r"C:\Users\owner\Downloads")));
    }
}
