//! One bounded latest snapshot for one trusted local scan operation.
//! This is not a selection registry, authorization boundary or native endpoint.
use crate::report::{ReportBindingError, valid_reference};
use sentinel_proto::{
    scan_progress::{DirectoryScanProgress, DirectoryScanStage},
    scan_report::BoundDirectoryProgress,
};
use std::sync::{Arc, Mutex};
#[derive(Clone)]
pub struct LatestScanProgress(Arc<Inner>);
struct Inner {
    job_id: String,
    selection_ref: String,
    state: Mutex<State>,
}
struct State {
    closed: bool,
    finished: bool,
    latest: Option<DirectoryScanProgress>,
}
impl LatestScanProgress {
    pub fn new(job_id: &str, selection_ref: &str) -> Result<Self, ReportBindingError> {
        if !valid_reference(job_id) || !valid_reference(selection_ref) {
            return Err(ReportBindingError);
        }
        Ok(Self(Arc::new(Inner {
            job_id: job_id.to_owned(),
            selection_ref: selection_ref.to_owned(),
            state: Mutex::new(State {
                closed: false,
                finished: false,
                latest: None,
            }),
        })))
    }
    /// Rejects wrong correlation, regressions and updates after final/close.
    /// Use only trusted scanner callbacks, not unvalidated transport messages.
    pub fn publish(
        &self,
        job_id: &str,
        selection_ref: &str,
        progress: &DirectoryScanProgress,
    ) -> bool {
        if !self.matches(job_id, selection_ref) {
            return false;
        }
        let Ok(mut state) = self.0.state.lock() else {
            return false;
        };
        if state.closed
            || state.finished
            || state
                .latest
                .as_ref()
                .is_some_and(|old| regresses(old, progress))
        {
            return false;
        }
        state.finished = progress.stage == DirectoryScanStage::Finished;
        state.latest = Some(progress.clone());
        true
    }
    /// Non-destructive latest copy; there is no queue/history to drain.
    /// Wrong correlation or closed/poisoned state yields None, not a zero report.
    pub fn latest(&self, job_id: &str, selection_ref: &str) -> Option<BoundDirectoryProgress> {
        if !self.matches(job_id, selection_ref) {
            return None;
        }
        let state = self.0.state.lock().ok()?;
        if state.closed {
            return None;
        }
        Some(BoundDirectoryProgress {
            job_id: self.0.job_id.clone(),
            selection_ref: self.0.selection_ref.clone(),
            progress: state.latest.clone()?,
        })
    }
    /// Invalidates abandoned operation output. Does not cancel or reap its worker.
    pub fn close(&self) {
        if let Ok(mut state) = self.0.state.lock() {
            state.closed = true;
            state.latest = None;
        }
    }
    fn matches(&self, job_id: &str, selection_ref: &str) -> bool {
        self.0.job_id == job_id && self.0.selection_ref == selection_ref
    }
}
fn regresses(old: &DirectoryScanProgress, new: &DirectoryScanProgress) -> bool {
    new.entries_visited < old.entries_visited
        || new.files_visited < old.files_visited
        || new.files_checked < old.files_checked
        || new.files_skipped < old.files_skipped
        || new.access_errors < old.access_errors
        || new.engine_failures < old.engine_failures
        || new.bytes_read < old.bytes_read
        || (old.cancelled && !new.cancelled)
        || (old.limit_reached && !new.limit_reached)
}
