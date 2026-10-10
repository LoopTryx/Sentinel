//! Internal native-owned jobs. Caller association must come from the trusted
//! adapter; a client supplied owner string is not authentication. Raw reports
//! remain private and must pass the canonical output adapter before transport.
use crate::engine::{scan_directory_with_control, Engine, ScanReport};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

#[derive(Clone, Copy)]
pub enum SelectionKind {
    File,
    Directory,
}

struct Selection {
    reference: String,
    owner: String,
    path: PathBuf,
    kind: SelectionKind,
    expires: Instant,
}

#[derive(Clone, Default)]
pub struct JobSnapshot {
    pub finished: bool,
    pub failed: bool,
    pub cancellation_requested: bool,
    /// Bytes acquired in the latest current file, not aggregate inspection.
    pub current_file_bytes: u64,
    pub reports: Vec<ScanReport>,
}

struct ActiveJob {
    reference: String,
    owner: String,
    cancel: Arc<AtomicBool>,
    bytes: Arc<AtomicU64>,
    reports: Arc<Mutex<Option<Vec<ScanReport>>>>,
    worker: Option<JoinHandle<()>>,
    failed: bool,
}

/// One selection and one retained job; no growing history or event queue.
pub struct SelectedJobs {
    engine: Arc<Engine>,
    hash_lookup: Arc<NativeHashLookup>,
    selection: Option<Selection>,
    job: Option<ActiveJob>,
}

/// Trusted native callback; it must be bounded and must not perform remote fetches.
pub type NativeHashLookup = dyn Fn(&str) -> Option<(String, String)> + Send + Sync;

impl Default for SelectedJobs {
    fn default() -> Self {
        Self {
            engine: Arc::new(Engine::new()),
            hash_lookup: Arc::new(|_| None),
            selection: None,
            job: None,
        }
    }
}

impl SelectedJobs {
    pub fn with_hash_lookup(hash_lookup: Arc<NativeHashLookup>) -> Self {
        let mut jobs = Self::default();
        jobs.hash_lookup = hash_lookup;
        jobs
    }
    pub fn select(
        &mut self,
        owner: &str,
        path: PathBuf,
        kind: SelectionKind,
        now: Instant,
    ) -> Result<String, &'static str> {
        if owner.is_empty() || owner.len() > 128 || path.as_os_str().len() > 2048 {
            return Err("invalid native selection");
        }
        let reference = uuid::Uuid::new_v4().simple().to_string();
        self.selection = Some(Selection {
            reference: reference.clone(),
            owner: owner.into(),
            path,
            kind,
            expires: now + Duration::from_secs(60),
        });
        Ok(reference)
    }

    fn reap(&mut self) {
        if let Some(job) = &mut self.job {
            if job.worker.as_ref().is_some_and(JoinHandle::is_finished) {
                job.failed = job.worker.take().unwrap().join().is_err();
            }
        }
    }

    pub fn start(
        &mut self,
        owner: &str,
        reference: &str,
        now: Instant,
    ) -> Result<String, &'static str> {
        self.reap();
        if self.job.as_ref().is_some_and(|job| job.worker.is_some()) {
            return Err("scan worker busy");
        }
        let selected = self.selection.as_ref().ok_or("selection unavailable")?;
        if selected.owner != owner || selected.reference != reference {
            return Err("selection unavailable");
        }
        let selected = self.selection.take().unwrap();
        if now >= selected.expires {
            return Err("selection expired");
        }
        let job_ref = uuid::Uuid::new_v4().simple().to_string();
        let cancel = Arc::new(AtomicBool::new(false));
        let bytes = Arc::new(AtomicU64::new(0));
        let reports = Arc::new(Mutex::new(None));
        let engine = self.engine.clone();
        let hash_lookup = self.hash_lookup.clone();
        let worker_cancel = cancel.clone();
        let worker_bytes = bytes.clone();
        let worker_reports = reports.clone();
        let worker = std::thread::Builder::new()
            .name("sentinel-selected-scan".into())
            .spawn(move || {
                let deadline = Instant::now() + Duration::from_secs(30);
                let mut cancelled = || worker_cancel.load(Ordering::Acquire);
                let mut progress = |count| {
                    worker_bytes.store(count, Ordering::Release);
                };
                let result = match selected.kind {
                    SelectionKind::File => vec![engine.scan_file_with_control(
                        &selected.path,
                        &*hash_lookup,
                        &mut cancelled,
                        &mut progress,
                        deadline,
                    )],
                    SelectionKind::Directory => scan_directory_with_control(
                        &engine,
                        &selected.path,
                        &*hash_lookup,
                        &mut cancelled,
                        &mut |_, count| progress(count),
                        deadline,
                    ),
                };
                if let Ok(mut output) = worker_reports.lock() {
                    *output = Some(result);
                }
            })
            .map_err(|_| "scan worker unavailable")?;
        self.job = Some(ActiveJob {
            reference: job_ref.clone(),
            owner: owner.into(),
            cancel,
            bytes,
            reports,
            worker: Some(worker),
            failed: false,
        });
        Ok(job_ref)
    }

    pub fn poll(&mut self, owner: &str, reference: &str) -> Result<JobSnapshot, &'static str> {
        self.reap();
        let job = self
            .job
            .as_ref()
            .filter(|job| job.owner == owner && job.reference == reference)
            .ok_or("job unavailable")?;
        let reports = job.reports.lock().map_err(|_| "job unavailable")?;
        Ok(JobSnapshot {
            finished: job.worker.is_none(),
            failed: job.failed || (job.worker.is_none() && reports.is_none()),
            cancellation_requested: job.cancel.load(Ordering::Acquire),
            current_file_bytes: job.bytes.load(Ordering::Acquire),
            reports: reports.as_ref().cloned().unwrap_or_default(),
        })
    }

    pub fn cancel(&mut self, owner: &str, reference: &str) -> Result<(), &'static str> {
        let job = self
            .job
            .as_ref()
            .filter(|job| job.owner == owner && job.reference == reference)
            .ok_or("job unavailable")?;
        job.cancel.store(true, Ordering::Release);
        Ok(())
    }
}

impl Drop for SelectedJobs {
    fn drop(&mut self) {
        if let Some(job) = &self.job {
            job.cancel.store(true, Ordering::Release);
        }
        // Application teardown requests cancellation; cooperative deadline is
        // not OS containment. Native shutdown must reconcile worker completion.
    }
}
