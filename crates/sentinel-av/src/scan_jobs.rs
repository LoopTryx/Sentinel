//! Internal native-owned jobs. Caller association must come from the trusted
//! adapter; a client supplied owner string is not authentication. Raw reports
//! remain private and must pass the canonical output adapter before transport.
#[cfg(not(windows))]
use crate::engine::scan_directory_with_control;
use crate::engine::{Engine, ScanReport};
use sentinel_proto::quarantine_action as quarantine;
use sentinel_proto::restore_action as restore;
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
    quarantine_attempted: [bool; 65],
}

struct PendingQuarantine {
    reference: String,
    owner: String,
    job_ref: String,
    selection_ref: String,
    report_ref: String,
    expires: Instant,
}

struct RestorableQuarantine {
    owner: String,
    path: PathBuf,
    receipt: quarantine::QuarantineReceipt,
    sha256: String,
    bytes: u64,
}

struct PendingRestore {
    owner: String,
    reference: String,
    quarantine_action_ref: String,
    expires: Instant,
}

/// One selection and one retained job; no growing history or event queue.
pub struct SelectedJobs {
    engine: Arc<Engine>,
    hash_lookup: Arc<NativeHashLookup>,
    selection: Option<Selection>,
    job: Option<ActiveJob>,
    pending_quarantine: Option<PendingQuarantine>,
    restorations: Vec<RestorableQuarantine>,
    pending_restore: Option<PendingRestore>,
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
            pending_quarantine: None,
            restorations: Vec::new(),
            pending_restore: None,
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
        self.pending_quarantine = None;
        self.pending_restore = None;
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
        if self
            .pending_quarantine
            .as_ref()
            .is_some_and(|action| now >= action.expires)
        {
            self.pending_quarantine = None;
        }
        self.reap();
        if self
            .pending_restore
            .as_ref()
            .is_some_and(|action| now >= action.expires)
        {
            self.pending_restore = None;
        }
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
                    #[cfg(windows)]
                    SelectionKind::Directory => {
                        crate::engine::scan_retained_directory_with_control(
                            &engine,
                            (&selected.path, &_ancestry),
                            &*hash_lookup,
                            &mut cancelled,
                            &mut |_, count| progress(count),
                            deadline,
                        )
                    }
                    #[cfg(not(windows))]
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
            quarantine_attempted: [false; 65],
        });
        self.pending_quarantine = None;
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
        self.pending_quarantine = None;
        self.pending_restore = None;
        Ok(())
    }

    /// Native-owned preview, not consent or action authority. Adapter derives
    /// owner/time and obtains separate explicit native confirmation.
    pub fn prepare_quarantine(
        &mut self,
        owner: &str,
        request: &quarantine::QuarantinePrepareRequest,
        now: Instant,
    ) -> Result<quarantine::QuarantinePreview, quarantine::QuarantineError> {
        use quarantine::{QuarantineError, QuarantineErrorCode as Code};
        request.validate().map_err(|_| QuarantineError {
            code: Code::InvalidRequest,
        })?;
        self.maintain(now);
        let job = self
            .job
            .as_ref()
            .filter(|job| job.owner == owner && job.reference == request.job_ref)
            .ok_or(QuarantineError {
                code: Code::JobUnavailable,
            })?;
        if job.worker.is_some() {
            return Err(QuarantineError { code: Code::Busy });
        }
        if job.failed || job.cancel.load(Ordering::Acquire) || self.selection.is_some() {
            return Err(QuarantineError {
                code: Code::ReportUnavailable,
            });
        }
        let index = quarantine::report_index(&request.report_ref).map_err(|_| QuarantineError {
            code: Code::InvalidRequest,
        })?;
        if job.quarantine_attempted[index] {
            return Err(QuarantineError {
                code: Code::ReportUnavailable,
            });
        }
        let reports = job.reports.lock().map_err(|_| QuarantineError {
            code: Code::ReportUnavailable,
        })?;
        let report = reports
            .as_ref()
            .and_then(|reports| reports.get(index))
            .filter(|report| {
                report.state == "completed"
                    && report.content_complete
                    && report.inspected_subject().is_some()
            })
            .ok_or(QuarantineError {
                code: Code::ReportUnavailable,
            })?;
        let inspection = crate::inspection_wire::inspection_snapshot(&request.report_ref, report)
            .map_err(|_| QuarantineError {
            code: Code::ReportUnavailable,
        })?;
        let preview = quarantine::QuarantinePreview {
            action_ref: uuid::Uuid::new_v4().simple().to_string(),
            selection_ref: job.selection_ref.clone(),
            job_ref: job.reference.clone(),
            report_ref: request.report_ref.clone(),
            expires_after_seconds: 30,
            inspection,
        };
        preview.validate().map_err(|_| QuarantineError {
            code: Code::ReportUnavailable,
        })?;
        self.pending_quarantine = Some(PendingQuarantine {
            reference: preview.action_ref.clone(),
            owner: owner.into(),
            job_ref: preview.job_ref.clone(),
            selection_ref: preview.selection_ref.clone(),
            report_ref: preview.report_ref.clone(),
            expires: now + Duration::from_secs(30),
        });
        Ok(preview)
    }

    /// Call only after an actual trusted native confirmation, passing a fresh
    /// native monotonic time. Never deserialize owner/time/confirmation/path.
    /// Recognized actions are consumed before decline, revalidation or mutation;
    /// a failed vault operation may require recovery, never automatic replay.
    pub fn quarantine_after_native_confirmation(
        &mut self,
        owner: &str,
        request: &quarantine::QuarantineActionReference,
        now: Instant,
        vault: &crate::vault::Vault,
        native_confirmation: bool,
    ) -> Result<quarantine::QuarantineReceipt, quarantine::QuarantineError> {
        use quarantine::{QuarantineError, QuarantineErrorCode as Code};
        request.validate().map_err(|_| QuarantineError {
            code: Code::InvalidRequest,
        })?;
        self.maintain(now);
        if !self
            .pending_quarantine
            .as_ref()
            .is_some_and(|action| action.owner == owner && action.reference == request.action_ref)
        {
            return Err(QuarantineError {
                code: Code::ActionUnavailable,
            });
        }
        let action = self
            .pending_quarantine
            .take()
            .expect("matched pending action");
        if !native_confirmation {
            return Err(QuarantineError {
                code: Code::Declined,
            });
        }
        if self.restorations.len() >= 64 {
            return Err(QuarantineError { code: Code::Busy });
        }
        let job = self
            .job
            .as_mut()
            .filter(|job| {
                job.owner == owner
                    && job.reference == action.job_ref
                    && job.selection_ref == action.selection_ref
            })
            .ok_or(QuarantineError {
                code: Code::ActionUnavailable,
            })?;
        if job.worker.is_some()
            || job.failed
            || job.cancel.load(Ordering::Acquire)
            || self.selection.is_some()
        {
            return Err(QuarantineError {
                code: Code::ActionUnavailable,
            });
        }
        let index = quarantine::report_index(&action.report_ref).map_err(|_| QuarantineError {
            code: Code::ActionUnavailable,
        })?;
        if job.quarantine_attempted[index] {
            return Err(QuarantineError {
                code: Code::ActionUnavailable,
            });
        }
        let (path, subject, sha256, bytes) = {
            let reports = job.reports.lock().map_err(|_| QuarantineError {
                code: Code::ActionUnavailable,
            })?;
            let report = reports
                .as_ref()
                .and_then(|reports| reports.get(index))
                .filter(|report| report.state == "completed" && report.content_complete)
                .ok_or(QuarantineError {
                    code: Code::ActionUnavailable,
                })?;
            let subject = report.inspected_subject().cloned().ok_or(QuarantineError {
                code: Code::ActionUnavailable,
            })?;
            (
                PathBuf::from(&report.path),
                subject,
                report.sha256.clone(),
                report.size,
            )
        };
        // A successful or failed approved attempt retires this historical
        // report for future actions. A fresh scan must observe current state.
        job.quarantine_attempted[index] = true;
        let outcome = vault
            .quarantine_inspected(&path, &subject)
            .map_err(|_| QuarantineError {
                code: Code::ActionFailed,
            })?;
        let receipt = quarantine::QuarantineReceipt {
            action_ref: action.reference,
            selection_ref: action.selection_ref,
            job_ref: action.job_ref,
            report_ref: action.report_ref,
            vault_file: outcome.vault_file,
            state: if outcome.original_removed {
                quarantine::QuarantineResultState::Quarantined
            } else {
                quarantine::QuarantineResultState::OriginalRetained
            },
        };
        receipt.validate().map_err(|_| QuarantineError {
            code: Code::ActionFailed,
        })?;
        if receipt.state == quarantine::QuarantineResultState::Quarantined {
            self.restorations.push(RestorableQuarantine {
                owner: owner.into(),
                path,
                receipt: receipt.clone(),
                sha256,
                bytes,
            });
        }
        Ok(receipt)
    }

    /// Native adapter shows the original private destination in its own dialog;
    /// the path is never supplied by or returned to browser/UI request bodies.
    pub fn prepare_restore(
        &mut self,
        owner: &str,
        request: &restore::RestorePrepareRequest,
        now: Instant,
    ) -> Result<restore::RestorePreview, quarantine::QuarantineError> {
        use quarantine::{QuarantineError, QuarantineErrorCode as Code};
        request.validate().map_err(|_| QuarantineError {
            code: Code::InvalidRequest,
        })?;
        self.maintain(now);
        let item = self
            .restorations
            .iter()
            .find(|item| {
                item.owner == owner && item.receipt.action_ref == request.quarantine_action_ref
            })
            .ok_or(QuarantineError {
                code: Code::ActionUnavailable,
            })?;
        let reference = uuid::Uuid::new_v4().simple().to_string();
        let preview = restore::RestorePreview {
            restore_ref: reference.clone(),
            quarantine: item.receipt.clone(),
            expires_after_seconds: 30,
        };
        preview.validate().map_err(|_| QuarantineError {
            code: Code::ActionFailed,
        })?;
        self.pending_restore = Some(PendingRestore {
            owner: owner.into(),
            reference,
            quarantine_action_ref: request.quarantine_action_ref.clone(),
            expires: now + Duration::from_secs(30),
        });
        Ok(preview)
    }

    /// Confirmation, owner, vault and monotonic time are trusted native inputs.
    /// Consume approval before filesystem access; no automatic retry/overwrite.
    pub fn restore_after_native_confirmation(
        &mut self,
        owner: &str,
        request: &restore::RestoreActionReference,
        now: Instant,
        vault: &crate::vault::Vault,
        native_confirmation: bool,
    ) -> Result<restore::RestoreReceipt, quarantine::QuarantineError> {
        use quarantine::{QuarantineError, QuarantineErrorCode as Code};
        request.validate().map_err(|_| QuarantineError {
            code: Code::InvalidRequest,
        })?;
        self.maintain(now);
        if !self
            .pending_restore
            .as_ref()
            .is_some_and(|action| action.owner == owner && action.reference == request.restore_ref)
        {
            return Err(QuarantineError {
                code: Code::ActionUnavailable,
            });
        }
        let action = self.pending_restore.take().expect("matched restore action");
        if !native_confirmation {
            return Err(QuarantineError {
                code: Code::Declined,
            });
        }
        let index = self
            .restorations
            .iter()
            .position(|item| {
                item.owner == owner && item.receipt.action_ref == action.quarantine_action_ref
            })
            .ok_or(QuarantineError {
                code: Code::ActionUnavailable,
            })?;
        let item = &self.restorations[index];
        let summary = vault
            .recovery_summary(&item.receipt.vault_file)
            .map_err(|_| QuarantineError {
                code: Code::ActionFailed,
            })?;
        if summary.sha256 != item.sha256
            || summary.plaintext_bytes != item.bytes.to_string()
            || summary.phase != crate::quarantine_journal::RecoveryPhase::RemovalRecorded
        {
            return Err(QuarantineError {
                code: Code::ActionFailed,
            });
        }
        vault
            .restore(&item.receipt.vault_file, &item.path)
            .map_err(|_| QuarantineError {
                code: Code::ActionFailed,
            })?;
        let item = self.restorations.remove(index);
        let receipt = restore::RestoreReceipt {
            restore_ref: action.reference,
            quarantine: item.receipt,
            state: restore::RestoreResultState::Restored,
        };
        receipt.validate().map_err(|_| QuarantineError {
            code: Code::ActionFailed,
        })?;
        Ok(receipt)
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

#[cfg(all(test, windows))]
mod retained_directory_tests {
    use super::*;

    #[test]
    fn directory_worker_reads_retained_subject_not_private_path_label() {
        let root =
            std::env::temp_dir().join(format!("sentinel-dir-address-{}", uuid::Uuid::new_v4()));
        let chosen = root.join("chosen");
        let decoy = root.join("decoy");
        std::fs::create_dir(&root).unwrap();
        std::fs::create_dir(&chosen).unwrap();
        std::fs::create_dir(&decoy).unwrap();
        let original = b"harmless retained directory bytes";
        std::fs::write(chosen.join("ordinary.txt"), original).unwrap();
        std::fs::write(decoy.join("ordinary.txt"), b"decoy").unwrap();
        let mut jobs = SelectedJobs::default();
        let selection = jobs
            .select(
                "trusted-main",
                chosen.clone(),
                SelectionKind::Directory,
                Instant::now(),
            )
            .unwrap();
        // Private-label substitution exercises the acquisition boundary without
        // mutating drive mappings. It is not an installed drive-remap test.
        jobs.selection.as_mut().unwrap().path = decoy.clone();
        let job = jobs
            .start("trusted-main", &selection, Instant::now())
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(10);
        let snapshot = loop {
            let snapshot = jobs.poll_wire("trusted-main", &job).unwrap();
            if snapshot.state == sentinel_proto::selected_scan::ScanWorkerState::Finished {
                break snapshot;
            }
            assert!(Instant::now() < deadline);
            std::thread::sleep(Duration::from_millis(10));
        };
        drop(jobs);
        assert_eq!(
            std::fs::read(chosen.join("ordinary.txt")).unwrap(),
            original
        );
        assert_eq!(std::fs::read(decoy.join("ordinary.txt")).unwrap(), b"decoy");
        for folder in [&chosen, &decoy] {
            std::fs::remove_file(folder.join("ordinary.txt")).unwrap();
            std::fs::remove_dir(folder).unwrap();
        }
        std::fs::remove_dir(root).unwrap();
        assert_eq!(snapshot.selection_ref, selection);
        assert_eq!(snapshot.reports.len(), 1);
        assert_eq!(
            snapshot.reports[0].inspected_bytes,
            original.len().to_string()
        );
    }
}
