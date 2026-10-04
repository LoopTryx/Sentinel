//! Native benign-sample dispatch. No RPC endpoint, sandbox or hard OS timeout.
use crate::{
    control::LocalScanControl,
    pipeline::{DirectoryLimits, ScanLimits, scan_directory_with_progress, scan_file_with_cancel},
    progress_slot::LatestScanProgress,
    report::{selected_directory_report, selected_file_report},
    selection::{NativeSelectionRegistry, SelectionKind},
};
use sentinel_proto::scan_report::{
    BoundDirectoryProgress, LocalScanControlState, SelectedDirectoryReport, SelectedFileReport,
};
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    thread::JoinHandle,
    time::Duration,
};

static SCAN_ADMITTED: AtomicBool = AtomicBool::new(false);
static NEXT_JOB: AtomicU64 = AtomicU64::new(1);
struct Admission;
impl Admission {
    fn acquire() -> Result<Arc<Self>, DispatchError> {
        SCAN_ADMITTED
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| DispatchError::Busy)?;
        Ok(Arc::new(Self))
    }
}
impl Drop for Admission {
    fn drop(&mut self) {
        SCAN_ADMITTED.store(false, Ordering::Release);
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ScanTicket {
    pub job_id: String,
    pub selection_ref: String,
}
#[derive(Clone, Debug)]
pub enum NativeScanReport {
    File(SelectedFileReport),
    Directory(SelectedDirectoryReport),
}
#[derive(Clone, Debug)]
pub struct DispatchSnapshot {
    pub state: LocalScanControlState,
    pub worker_returned: bool,
    pub abandoned: bool,
    pub progress: Option<BoundDirectoryProgress>,
    pub report: Option<NativeScanReport>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DispatchError {
    Busy,
    InvalidSelection,
    InvalidDeadline,
    WrongOperation,
    Unavailable,
    WorkerFailed,
}
impl std::fmt::Display for DispatchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Busy => "local scan busy",
            Self::InvalidSelection => "invalid native selection",
            Self::InvalidDeadline => "invalid local scan deadline",
            Self::WrongOperation => "wrong local scan operation",
            Self::Unavailable => "local scan unavailable",
            Self::WorkerFailed => "local scan worker failed",
        })
    }
}
impl std::error::Error for DispatchError {}
struct Session {
    ticket: ScanTicket,
    control: LocalScanControl,
    progress: LatestScanProgress,
    worker: Option<JoinHandle<Result<NativeScanReport, DispatchError>>>,
    admission: Option<Arc<Admission>>,
    outcome: Option<Result<NativeScanReport, DispatchError>>,
    abandoned: bool,
}
impl Drop for Session {
    fn drop(&mut self) {
        self.control.request_cancel();
        self.progress.close();
    }
}
#[derive(Default)]
pub struct NativeScanDispatcher {
    session: Option<Session>,
}
impl NativeScanDispatcher {
    pub fn new() -> Self {
        Self::default()
    }
    /// Native caller must register a trusted picker selection first. Fixed small
    /// S1 limits: 8 MiB/file, 128 entries/pending dirs, depth 4, 64 findings.
    pub fn start(
        &mut self,
        registry: &NativeSelectionRegistry,
        selection_ref: &str,
        timeout: Duration,
    ) -> Result<ScanTicket, DispatchError> {
        if self.session.is_some() {
            return Err(DispatchError::Busy);
        }
        let selected = registry
            .resolve(selection_ref)
            .ok_or(DispatchError::InvalidSelection)?;
        let control = LocalScanControl::new(timeout).map_err(|_| DispatchError::InvalidDeadline)?;
        let admission = Admission::acquire()?;
        let sequence = NEXT_JOB
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |v| v.checked_add(1))
            .map_err(|_| DispatchError::Unavailable)?;
        let ticket = ScanTicket {
            job_id: format!("job-{sequence}"),
            selection_ref: selection_ref.to_owned(),
        };
        let progress = LatestScanProgress::new(&ticket.job_id, &ticket.selection_ref)
            .map_err(|_| DispatchError::Unavailable)?;
        let path = selected.path().to_owned();
        let kind = selected.kind();
        let worker_ticket = ticket.clone();
        let worker_control = control.clone();
        let worker_progress = progress.clone();
        self.spawn(ticket, control, progress, admission, move || {
            let limits = ScanLimits {
                max_file_bytes: 8 * 1024 * 1024,
            };
            let result = match kind {
                SelectionKind::File => selected_file_report(
                    &scan_file_with_cancel(&path, limits, &mut || worker_control.should_stop()),
                    &worker_ticket.job_id,
                    &worker_ticket.selection_ref,
                )
                .map(NativeScanReport::File),
                SelectionKind::Directory => {
                    let result = scan_directory_with_progress(
                        &path,
                        limits,
                        DirectoryLimits {
                            max_entries: 128,
                            max_depth: 4,
                            max_pending_dirs: 128,
                            max_findings: 64,
                        },
                        || worker_control.should_stop(),
                        |p| {
                            worker_progress.publish(
                                &worker_ticket.job_id,
                                &worker_ticket.selection_ref,
                                p,
                            );
                        },
                    );
                    selected_directory_report(
                        &result,
                        &worker_ticket.job_id,
                        &worker_ticket.selection_ref,
                    )
                    .map(NativeScanReport::Directory)
                }
            }
            .map_err(|_| DispatchError::WorkerFailed);
            worker_control.finish();
            result
        })
    }
    fn spawn(
        &mut self,
        ticket: ScanTicket,
        control: LocalScanControl,
        progress: LatestScanProgress,
        admission: Arc<Admission>,
        work: impl FnOnce() -> Result<NativeScanReport, DispatchError> + Send + 'static,
    ) -> Result<ScanTicket, DispatchError> {
        let worker_admission = admission.clone();
        let worker = std::thread::Builder::new()
            .name("sentinel-benign-scan".into())
            .spawn(move || {
                let _permit = worker_admission;
                work()
            })
            .map_err(|_| DispatchError::Unavailable)?;
        self.session = Some(Session {
            ticket: ticket.clone(),
            control,
            progress,
            worker: Some(worker),
            admission: Some(admission),
            outcome: None,
            abandoned: false,
        });
        Ok(ticket)
    }
    /// Nonblocking observation. Join only after is_finished; never confuse
    /// requested timeout/cancel with worker return. Retains one path-free result.
    pub fn poll(&mut self, ticket: &ScanTicket) -> Result<DispatchSnapshot, DispatchError> {
        let session = self
            .session
            .as_mut()
            .filter(|s| s.ticket == *ticket)
            .ok_or(DispatchError::WrongOperation)?;
        if session.worker.as_ref().is_some_and(|w| w.is_finished()) {
            let worker = session.worker.take().expect("checked worker");
            session.outcome = Some(worker.join().unwrap_or(Err(DispatchError::WorkerFailed)));
            session.control.finish();
            session.admission = None;
        }
        if let Some(Err(error)) = session.outcome.as_ref() {
            return Err(*error);
        }
        Ok(DispatchSnapshot {
            state: session.control.state(),
            worker_returned: session.worker.is_none(),
            abandoned: session.abandoned,
            progress: if session.abandoned {
                None
            } else {
                session
                    .progress
                    .latest(&ticket.job_id, &ticket.selection_ref)
            },
            report: if session.abandoned {
                None
            } else {
                session
                    .outcome
                    .as_ref()
                    .and_then(|v| v.as_ref().ok())
                    .cloned()
            },
        })
    }
    pub fn cancel(&self, ticket: &ScanTicket) -> bool {
        let Some(session) = self.session.as_ref().filter(|s| s.ticket == *ticket) else {
            return false;
        };
        session.control.request_cancel();
        true
    }
    /// Suppresses abandoned output and requests cancellation. Still poll/reap;
    /// neither abandonment nor selection replacement interrupts blocked I/O.
    pub fn abandon(&mut self, ticket: &ScanTicket) -> bool {
        let Some(session) = self.session.as_mut().filter(|s| s.ticket == *ticket) else {
            return false;
        };
        session.abandoned = true;
        session.control.request_cancel();
        session.progress.close();
        true
    }
    pub fn clear_returned(&mut self, ticket: &ScanTicket) -> bool {
        if !self
            .session
            .as_ref()
            .is_some_and(|s| s.ticket == *ticket && s.worker.is_none())
        {
            return false;
        }
        self.session = None;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    fn held(
        dispatcher: &mut NativeScanDispatcher,
        timeout: Duration,
    ) -> (ScanTicket, mpsc::Sender<()>) {
        let ticket = ScanTicket {
            job_id: "held-job".into(),
            selection_ref: "held-selection".into(),
        };
        let control = LocalScanControl::new(timeout).unwrap();
        let worker_control = control.clone();
        let worker_ticket = ticket.clone();
        let progress = LatestScanProgress::new(&ticket.job_id, &ticket.selection_ref).unwrap();
        let (release, wait) = mpsc::channel();
        dispatcher
            .spawn(
                ticket.clone(),
                control,
                progress,
                Admission::acquire().unwrap(),
                move || {
                    wait.recv().unwrap();
                    let result = scan_file_with_cancel(
                        "nonexistent-test-selection",
                        ScanLimits::default(),
                        &mut || worker_control.should_stop(),
                    );
                    worker_control.finish();
                    selected_file_report(
                        &result,
                        &worker_ticket.job_id,
                        &worker_ticket.selection_ref,
                    )
                    .map(NativeScanReport::File)
                    .map_err(|_| DispatchError::WorkerFailed)
                },
            )
            .unwrap();
        (ticket, release)
    }
    fn returned(dispatcher: &mut NativeScanDispatcher, ticket: &ScanTicket) -> DispatchSnapshot {
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        loop {
            let snapshot = dispatcher.poll(ticket).unwrap();
            if snapshot.worker_returned {
                return snapshot;
            }
            assert!(std::time::Instant::now() < deadline);
            std::thread::yield_now();
        }
    }
    #[test]
    fn held_worker_deadline_abandon_drop_and_panic_keep_admission_truthful() {
        let mut dispatcher = NativeScanDispatcher::new();
        let (ticket, release) = held(&mut dispatcher, Duration::from_millis(1));
        assert!(matches!(Admission::acquire(), Err(DispatchError::Busy)));
        std::thread::sleep(Duration::from_millis(10));
        let snapshot = dispatcher.poll(&ticket).unwrap();
        assert_eq!(snapshot.state, LocalScanControlState::TimedOut);
        assert!(!snapshot.worker_returned);
        assert!(snapshot.report.is_none());
        assert!(!dispatcher.clear_returned(&ticket));
        release.send(()).unwrap();
        let snapshot = returned(&mut dispatcher, &ticket);
        assert_eq!(snapshot.state, LocalScanControlState::TimedOut);
        match snapshot.report.unwrap() {
            NativeScanReport::File(r) => assert_eq!(
                r.state,
                sentinel_proto::scan_report::FileScanOutcome::Cancelled
            ),
            _ => panic!("wrong report"),
        }
        assert!(dispatcher.clear_returned(&ticket));

        let (ticket, release) = held(&mut dispatcher, Duration::from_secs(2));
        assert!(dispatcher.abandon(&ticket));
        release.send(()).unwrap();
        let snapshot = returned(&mut dispatcher, &ticket);
        assert!(snapshot.abandoned);
        assert!(snapshot.report.is_none());
        assert!(snapshot.progress.is_none());
        assert_eq!(snapshot.state, LocalScanControlState::Cancelled);
        assert!(dispatcher.clear_returned(&ticket));

        let (_ticket, release) = held(&mut dispatcher, Duration::from_secs(2));
        drop(dispatcher);
        assert!(matches!(Admission::acquire(), Err(DispatchError::Busy)));
        release.send(()).unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        let permit = loop {
            match Admission::acquire() {
                Ok(p) => break p,
                Err(DispatchError::Busy) => {
                    assert!(std::time::Instant::now() < deadline);
                    std::thread::yield_now();
                }
                Err(e) => panic!("{e}"),
            }
        };
        let mut dispatcher = NativeScanDispatcher::new();
        let ticket = ScanTicket {
            job_id: "panic-job".into(),
            selection_ref: "panic-selection".into(),
        };
        let control = LocalScanControl::new(Duration::from_secs(2)).unwrap();
        dispatcher
            .spawn(
                ticket.clone(),
                control,
                LatestScanProgress::new(&ticket.job_id, &ticket.selection_ref).unwrap(),
                permit,
                || panic!("invented worker failure"),
            )
            .unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        loop {
            match dispatcher.poll(&ticket) {
                Err(DispatchError::WorkerFailed) => break,
                Ok(_) => {
                    assert!(std::time::Instant::now() < deadline);
                    std::thread::yield_now();
                }
                Err(e) => panic!("{e}"),
            }
        }
        assert_eq!(
            dispatcher.poll(&ticket).unwrap_err(),
            DispatchError::WorkerFailed
        );
        assert!(dispatcher.clear_returned(&ticket));
    }
}
