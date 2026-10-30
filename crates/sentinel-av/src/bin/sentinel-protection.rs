//! Owned stdin/stdout worker. No listener or browser-provided filesystem access.
#[cfg(windows)]
mod native {
    use sentinel_av::{
        engine::Engine, official_signatures::OfficialEngine, protection, vault::Vault,
    };
    use serde::Deserialize;
    use std::{
        collections::{HashMap, VecDeque},
        io::{self, BufRead, Read, Write},
        path::{Path, PathBuf},
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc, Mutex,
        },
        time::{Duration, Instant, SystemTime},
    };
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct Configuration {
        engine_directory: PathBuf,
        databases: PathBuf,
        vault_root: PathBuf,
        downloads: PathBuf,
    }
    #[derive(Clone, Copy, PartialEq, Deserialize)]
    #[serde(rename_all = "snake_case")]
    enum Mode {
        Quick,
        Full,
        Download,
        Selected,
        Reconcile,
    }
    #[derive(Deserialize)]
    #[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
    enum Command {
        Scan {
            id: String,
            mode: Mode,
            roots: Vec<PathBuf>,
        },
        Cancel {
            id: String,
        },
        Shutdown,
    }
    struct Job {
        id: String,
        mode: Mode,
        roots: Vec<PathBuf>,
        cancel: Arc<AtomicBool>,
    }
    #[derive(Default)]
    struct Shared {
        jobs: VecDeque<Job>,
        flags: HashMap<String, Arc<AtomicBool>>,
        closed: bool,
    }
    fn emit(value: serde_json::Value) -> io::Result<()> {
        let mut out = io::stdout().lock();
        serde_json::to_writer(&mut out, &value)?;
        writeln!(out)?;
        out.flush()
    }
    fn read_line(input: &mut impl BufRead) -> Result<Option<String>, ()> {
        let mut line = String::new();
        let count = input
            .by_ref()
            .take(32769)
            .read_line(&mut line)
            .map_err(|_| ())?;
        if count == 0 {
            return Ok(None);
        }
        if count > 32768 || !line.ends_with('\n') {
            return Err(());
        }
        Ok(Some(line))
    }
    fn id_ok(id: &str) -> bool {
        id.len() == 32
            && id
                .bytes()
                .all(|v| v.is_ascii_hexdigit() && !v.is_ascii_uppercase())
    }
    fn safe(path: &Path) -> bool {
        path.is_absolute()
            && !path
                .to_string_lossy()
                .to_ascii_lowercase()
                .starts_with("e:")
            && !path.to_string_lossy().starts_with(r"\\")
            && !path
                .components()
                .any(|c| matches!(c, std::path::Component::ParentDir))
    }
    fn within(path: &Path, root: &Path) -> bool {
        let p = path.to_string_lossy().to_ascii_lowercase();
        let r = root
            .to_string_lossy()
            .trim_end_matches(['\\', '/'])
            .to_ascii_lowercase();
        p.starts_with(&(r + "\\"))
    }
    fn start_reader(shared: Arc<Mutex<Shared>>, downloads: PathBuf) {
        std::thread::spawn(move || {
            let mut input = io::stdin().lock();
            while let Ok(Some(line)) = read_line(&mut input) {
                let Ok(command) = serde_json::from_str::<Command>(&line) else {
                    break;
                };
                let mut state = shared.lock().unwrap();
                match command {
                    Command::Shutdown => break,
                    Command::Cancel { id } => {
                        if let Some(flag) = state.flags.get(&id) {
                            flag.store(true, Ordering::Release);
                        }
                    }
                    Command::Scan { id, mode, roots } => {
                        if !id_ok(&id)
                            || roots.is_empty()
                            || roots.len() > 32
                            || roots.iter().any(|p| !safe(p))
                            || mode == Mode::Download
                                && (roots.len() != 1 || !within(&roots[0], &downloads))
                            || mode == Mode::Reconcile
                                && (roots.len() != 1
                                    || !roots[0]
                                        .to_string_lossy()
                                        .eq_ignore_ascii_case(&downloads.to_string_lossy()))
                            || state.flags.contains_key(&id)
                        {
                            let _ = emit(
                                serde_json::json!({"type":"error","id":id,"code":"invalid_request"}),
                            );
                            continue;
                        }
                        if state.jobs.len() >= 256 {
                            let _ = emit(
                                serde_json::json!({"type":"error","id":id,"code":"queue_full"}),
                            );
                            continue;
                        }
                        let flag = Arc::new(AtomicBool::new(false));
                        state.flags.insert(id.clone(), flag.clone());
                        state.jobs.push_back(Job {
                            id,
                            mode,
                            roots,
                            cancel: flag,
                        });
                    }
                }
            }
            let mut state = shared.lock().unwrap();
            state.closed = true;
            for flag in state.flags.values() {
                flag.store(true, Ordering::Release);
            }
        });
    }
    struct Counters {
        checked: u64,
        skipped: u64,
        findings: u64,
        quarantined: u64,
        bytes: u64,
        limited: bool,
        current_file: Option<String>,
    }
    fn progress(job: &Job, c: &Counters, state: &str) {
        let _ = emit(
            serde_json::json!({"type":"progress","id":job.id,"state":state,"checked":c.checked,"skipped":c.skipped,"findings":c.findings,"quarantined":c.quarantined,"bytes":c.bytes,"currentFile":c.current_file,"limited":c.limited}),
        );
    }
    fn pop(shared: &Arc<Mutex<Shared>>, downloads_only: bool) -> Option<Job> {
        let mut state = shared.lock().unwrap();
        let index = state
            .jobs
            .iter()
            .position(|j| j.mode == Mode::Download)
            .or(if downloads_only { None } else { Some(0) })?;
        state.jobs.remove(index)
    }
    fn run_job(
        job: Job,
        shared: &Arc<Mutex<Shared>>,
        config: &Configuration,
        engine: &Engine,
        official: &OfficialEngine,
        vault: &Vault,
    ) {
        let mut c = Counters {
            checked: 0,
            skipped: 0,
            findings: 0,
            quarantined: 0,
            bytes: 0,
            limited: false,
            current_file: None,
        };
        progress(&job, &c, "scanning");
        let mut walk = protection::Walk::new(
            job.roots.clone(),
            vec![
                config.vault_root.clone(),
                config.engine_directory.clone(),
                config.databases.clone(),
            ],
        );
        let deadline = Instant::now() + Duration::from_secs(4 * 3600);
        let mut last = Instant::now();
        'scan: for (entries, entry) in walk.by_ref().enumerate() {
            if job.cancel.load(Ordering::Acquire) {
                break;
            }
            if Instant::now() >= deadline || entries >= 1_000_000 {
                c.limited = true;
                break;
            }
            // Download jobs interrupt manual traversal at file boundaries; definitions
            // stay compiled once in this owned worker.
            if job.mode != Mode::Download {
                for _ in 0..4 {
                    let Some(next) = pop(shared, job.mode != Mode::Reconcile) else {
                        break;
                    };
                    progress(&job, &c, "paused");
                    run_job(next, shared, config, engine, official, vault);
                    progress(&job, &c, "scanning");
                    if job.cancel.load(Ordering::Acquire) {
                        break 'scan;
                    }
                }
            }
            if last.elapsed() >= Duration::from_millis(500) {
                progress(&job, &c, "scanning");
                last = Instant::now();
            }
            let (path, metadata) = match entry {
                Ok(v) => v,
                Err(_) => {
                    c.skipped += 1;
                    continue;
                }
            };
            if metadata.is_dir() {
                continue;
            }
            if !metadata.is_file() {
                c.skipped += 1;
                continue;
            }
            if matches!(job.mode, Mode::Download | Mode::Reconcile) {
                let extension = path
                    .extension()
                    .and_then(|v| v.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();
                if matches!(
                    extension.as_str(),
                    "crdownload" | "part" | "partial" | "tmp" | "download"
                ) {
                    continue;
                }
            }
            if matches!(job.mode, Mode::Quick | Mode::Reconcile) && within(&path, &config.downloads)
            {
                let recent = metadata
                    .modified()
                    .ok()
                    .and_then(|t| SystemTime::now().duration_since(t).ok())
                    .map(|d| d <= Duration::from_secs(7 * 86400))
                    .unwrap_or(true);
                if !recent {
                    continue;
                }
            }
            c.current_file = Some(path.to_string_lossy().chars().take(1024).collect());
            progress(&job, &c, "scanning");
            let outcome = protection::inspect(
                engine,
                official,
                &path,
                matches!(job.mode, Mode::Download | Mode::Reconcile),
                vault,
                &job.cancel,
            );
            c.bytes += outcome.bytes;
            if outcome.state == "incomplete" || outcome.state == "cancelled" {
                c.skipped += 1;
            } else {
                c.checked += 1;
            }
            if !outcome.signals.is_empty() {
                c.findings += 1;
                let _ = emit(serde_json::json!({"type":"finding","id":job.id,"file":outcome}));
            }
            if outcome.quarantine_state.as_deref() == Some("quarantined") {
                c.quarantined += 1;
            }
            if last.elapsed() >= Duration::from_millis(500) {
                progress(&job, &c, "scanning");
                last = Instant::now();
            }
        }
        c.limited |= walk.limited;
        c.current_file = None;
        progress(
            &job,
            &c,
            if job.cancel.load(Ordering::Acquire) {
                "cancelled"
            } else if c.limited || c.skipped > 0 {
                "incomplete"
            } else {
                "completed"
            },
        );
        shared.lock().unwrap().flags.remove(&job.id);
    }
    pub fn run() -> Result<(), String> {
        let config_line = read_line(&mut io::stdin().lock())
            .map_err(|_| "configuration unavailable")?
            .ok_or("configuration unavailable")?;
        let config: Configuration =
            serde_json::from_str(&config_line).map_err(|_| "invalid configuration")?;
        if [
            &config.engine_directory,
            &config.databases,
            &config.vault_root,
            &config.downloads,
        ]
        .iter()
        .any(|p| !safe(p))
        {
            return Err("unsafe configuration".into());
        }
        let shared = Arc::new(Mutex::new(Shared::default()));
        start_reader(shared.clone(), config.downloads.clone());
        let official = OfficialEngine::load(&config.engine_directory, &config.databases)?;
        let engine = Engine::new();
        let vault = Vault::new(&config.vault_root);
        emit(serde_json::json!({"type":"ready","signatures":official.count,"builtAt":official.built_at,"fresh":official.fresh()})).map_err(|_|"parent unavailable")?;
        loop {
            if shared.lock().unwrap().closed {
                break;
            }
            if let Some(job) = pop(&shared, false) {
                run_job(job, &shared, &config, &engine, &official, &vault);
            } else {
                std::thread::sleep(Duration::from_millis(50));
            }
        }
        Ok(())
    }
}
#[cfg(windows)]
fn main() {
    if let Err(error) = native::run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
#[cfg(not(windows))]
fn main() {
    eprintln!("Windows native protection unavailable");
    std::process::exit(2);
}
