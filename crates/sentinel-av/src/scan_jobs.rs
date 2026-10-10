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
    file: Option<std::fs::File>,
    #[cfg(windows)]
    ancestry: crate::storage_path::DirectoryGuard,
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
    selection_ref: String,
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
        self.maintain(now);
        #[cfg(windows)]
        let ancestry = {
            if !crate::engine::local_selection_path(&path) {
                return Err("selected subject unsupported");
            }
            crate::storage_path::retain_scan_ancestry(
                &path,
                matches!(kind, SelectionKind::Directory),
            )
            .map_err(|_| "selected subject ancestry unavailable")?
        };
        #[cfg(windows)]
        let open_path = if matches!(kind, SelectionKind::Directory) {
            ancestry.path.clone()
        } else {
            ancestry
                .path
                .join(path.file_name().ok_or("selected filename unavailable")?)
        };
        #[cfg(not(windows))]
        let open_path = path.clone();
        let file = match kind {
            SelectionKind::File => {
                if !crate::engine::local_selection_path(&path) {
                    return Err("selected file unsupported");
                }
                let selected = std::fs::symlink_metadata(&open_path)
                    .map_err(|_| "selected file unavailable")?;
                if !selected.is_file() || crate::engine::is_reparse(&selected) {
                    return Err("selected file unsupported");
                }
                let mut options = std::fs::OpenOptions::new();
                options.read(true);
                #[cfg(windows)]
                {
                    use std::os::windows::fs::OpenOptionsExt;
                    options.share_mode(1).custom_flags(0x0020_0000);
                }
                let file = options
                    .open(&open_path)
                    .map_err(|_| "selected file unavailable")?;
                let metadata = file.metadata().map_err(|_| "selected file unavailable")?;
                if !metadata.is_file() || crate::engine::is_reparse(&metadata) {
                    return Err("selected file unsupported");
                }
                Some(file)
            }
            SelectionKind::Directory => {
                if !crate::engine::local_selection_path(&path) {
                    return Err("selected directory unsupported");
                }
                let selected = std::fs::symlink_metadata(&open_path)
                    .map_err(|_| "selected directory unavailable")?;
                if !selected.is_dir() || crate::engine::is_reparse(&selected) {
                    return Err("selected directory unsupported");
                }
                let mut options = std::fs::OpenOptions::new();
                options.read(true);
                #[cfg(windows)]
                {
                    use std::os::windows::fs::OpenOptionsExt;
                    // Read-only directory handle: retain root, deny rename,
                    // do not follow a replacement leaf reparse point.
                    options.share_mode(1).custom_flags(0x0220_0000);
                }
                let directory = options
                    .open(&open_path)
                    .map_err(|_| "selected directory unavailable")?;
                let metadata = directory
                    .metadata()
                    .map_err(|_| "selected directory unavailable")?;
                if !metadata.is_dir() || crate::engine::is_reparse(&metadata) {
                    return Err("selected directory unsupported");
                }
                Some(directory)
            }
        };
        let reference = uuid::Uuid::new_v4().simple().to_string();
        self.selection = Some(Selection {
            reference: reference.clone(),
            owner: owner.into(),
            path,
            kind,
            expires: now + Duration::from_secs(60),
            file,
            #[cfg(windows)]
            ancestry,
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

    /// Trusted native timer/operation hook, using a native monotonic clock.
    /// Releases unused expired selections even while a different worker runs.
    /// This is not an autonomous timer or a worker interruption mechanism.
    pub fn maintain(&mut self, now: Instant) -> bool {
        let expired = self
            .selection
            .as_ref()
            .is_some_and(|selection| now >= selection.expires);
        if expired {
            self.selection = None;
        }
        self.reap();
        expired
    }

    pub fn start(
        &mut self,
        owner: &str,
        reference: &str,
        now: Instant,
    ) -> Result<String, &'static str> {
        self.maintain(now);
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
        let selection_ref = selected.reference.clone();
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
                #[cfg(windows)]
                let _ancestry = selected.ancestry;
                let deadline = Instant::now() + Duration::from_secs(30);
                let mut cancelled = || worker_cancel.load(Ordering::Acquire);
                let mut progress = |count| {
                    worker_bytes.store(count, Ordering::Release);
                };
                let result = match selected.kind {
                    SelectionKind::File => vec![engine.scan_retained_file_with_control(
                        (
                            &selected.path,
                            selected
                                .file
                                .as_ref()
                                .expect("file selection retains handle"),
                        ),
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
            selection_ref,
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
        self.maintain(Instant::now());
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
        self.maintain(Instant::now());
        let job = self
            .job
            .as_ref()
            .filter(|job| job.owner == owner && job.reference == reference)
            .ok_or("job unavailable")?;
        job.cancel.store(true, Ordering::Release);
        Ok(())
    }

    /// Canonical output from the privately correlated job. Native must derive
    /// owner from authenticated caller context; references alone grant no access.
    pub fn start_wire(
        &mut self,
        owner: &str,
        request: &sentinel_proto::selected_scan::ScanStartRequest,
        now: Instant,
    ) -> Result<
        sentinel_proto::selected_scan::ScanJobReference,
        sentinel_proto::selected_scan::ScanError,
    > {
        use sentinel_proto::selected_scan::{ScanError, ScanErrorCode, ScanJobReference};
        request.validate().map_err(|_| ScanError {
            code: ScanErrorCode::InvalidRequest,
        })?;
        let job_ref = self
            .start(owner, &request.selection_ref, now)
            .map_err(|error| ScanError {
                code: match error {
                    "scan worker busy" => ScanErrorCode::Busy,
                    "selection unavailable" | "selection expired" => {
                        ScanErrorCode::SelectionUnavailable
                    }
                    _ => ScanErrorCode::Unavailable,
                },
            })?;
        let response = ScanJobReference { job_ref };
        response.validate().map_err(|_| ScanError {
            code: ScanErrorCode::Unavailable,
        })?;
        Ok(response)
    }

    /// Sticky cancellation acknowledgment, never immediate worker termination.
    pub fn cancel_wire(
        &mut self,
        owner: &str,
        request: &sentinel_proto::selected_scan::ScanJobReference,
    ) -> Result<
        sentinel_proto::selected_scan::ScanCancelResponse,
        sentinel_proto::selected_scan::ScanError,
    > {
        use sentinel_proto::selected_scan::{ScanCancelResponse, ScanError, ScanErrorCode};
        request.validate().map_err(|_| ScanError {
            code: ScanErrorCode::InvalidRequest,
        })?;
        self.cancel(owner, &request.job_ref)
            .map_err(|_| ScanError {
                code: ScanErrorCode::JobUnavailable,
            })?;
        Ok(ScanCancelResponse {
            job_ref: request.job_ref.clone(),
            cancellation_requested: true,
        })
    }

    /// Canonical output from the privately correlated job. Native must derive
    /// owner from authenticated caller context; references alone grant no access.
    pub fn poll_wire(
        &mut self,
        owner: &str,
        reference: &str,
    ) -> Result<
        sentinel_proto::selected_scan::ScanJobSnapshot,
        sentinel_proto::selected_scan::ScanError,
    > {
        use sentinel_proto::selected_scan::{
            ScanError, ScanErrorCode, ScanJobSnapshot, ScanWorkerState,
        };
        let request = sentinel_proto::selected_scan::ScanJobReference {
            job_ref: reference.into(),
        };
        request.validate().map_err(|_| ScanError {
            code: ScanErrorCode::InvalidRequest,
        })?;
        let snapshot = self.poll(owner, reference).map_err(|_| ScanError {
            code: ScanErrorCode::JobUnavailable,
        })?;
        let job = self.job.as_ref().ok_or(ScanError {
            code: ScanErrorCode::JobUnavailable,
        })?;
        let reports = snapshot
            .reports
            .iter()
            .enumerate()
            .map(|(index, report)| {
                crate::inspection_wire::inspection_snapshot(&format!("report_{index}"), report)
                    .map_err(|_| ScanError {
                        code: ScanErrorCode::InspectionUnavailable,
                    })
            })
            .collect::<Result<Vec<_>, _>>()?;
        let wire = ScanJobSnapshot {
            selection_ref: job.selection_ref.clone(),
            job_ref: job.reference.clone(),
            state: if snapshot.failed {
                ScanWorkerState::Failed
            } else if snapshot.finished {
                ScanWorkerState::Finished
            } else {
                ScanWorkerState::Running
            },
            cancellation_requested: snapshot.cancellation_requested,
            current_file_bytes: snapshot.current_file_bytes.to_string(),
            reports,
        };
        wire.validate().map_err(|_| ScanError {
            code: ScanErrorCode::InspectionUnavailable,
        })?;
        Ok(wire)
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
