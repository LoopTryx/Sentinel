//! Output-only conversion for a trusted serialized native adapter.
use crate::{
    dispatch::{DispatchError, DispatchSnapshot, NativeScanReport, ScanTicket},
    report::{MAX_REPORT_FINDINGS, valid_reference},
};
use sentinel_proto::{
    scan_dispatch::{LocalScanDispatchError, LocalScanReport, LocalScanSnapshot, LocalScanTicket},
    scan_report::LocalScanControlState,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct InvalidDispatchSnapshot;
impl std::fmt::Display for InvalidDispatchSnapshot {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("invalid native scan snapshot")
    }
}
impl std::error::Error for InvalidDispatchSnapshot {}

/// Trusted host owns one dispatcher/registry and serializes picker/poll calls.
/// Does not register a command, accept paths, or activate scan capabilities.
pub fn poll_current_response(
    dispatcher: &mut crate::dispatch::NativeScanDispatcher,
    registry: &crate::selection::NativeSelectionRegistry,
    ticket: &ScanTicket,
) -> sentinel_proto::scan_dispatch::LocalScanPollResponse {
    use sentinel_proto::scan_dispatch::LocalScanPollResponse;
    match dispatcher.poll_current(registry, ticket) {
        Ok(snapshot) => match dispatch_snapshot(ticket, &snapshot) {
            Ok(wire) => LocalScanPollResponse::Snapshot(Box::new(wire)),
            Err(_) => LocalScanPollResponse::Error(LocalScanDispatchError::InvalidSnapshot),
        },
        Err(error) => LocalScanPollResponse::Error(dispatch_error(error)),
    }
}

pub fn dispatch_snapshot(
    ticket: &ScanTicket,
    snapshot: &DispatchSnapshot,
) -> Result<LocalScanSnapshot, InvalidDispatchSnapshot> {
    if !valid_reference(&ticket.job_id)
        || !valid_reference(&ticket.selection_ref)
        || (snapshot.abandoned && (snapshot.progress.is_some() || snapshot.report.is_some()))
        || (!snapshot.worker_returned && snapshot.report.is_some())
        || (snapshot.state == LocalScanControlState::Returned && !snapshot.worker_returned)
        || (snapshot.state == LocalScanControlState::Running && snapshot.worker_returned)
    {
        return Err(InvalidDispatchSnapshot);
    }
    let matches =
        |job: &str, selection: &str| job == ticket.job_id && selection == ticket.selection_ref;
    if snapshot
        .progress
        .as_ref()
        .is_some_and(|p| !matches(&p.job_id, &p.selection_ref))
    {
        return Err(InvalidDispatchSnapshot);
    }
    let report = match snapshot.report.as_ref() {
        Some(NativeScanReport::File(r)) => {
            if !matches(&r.job_id, &r.selection_ref)
                || snapshot.progress.is_some()
                || r.sha256.as_ref().is_some_and(|hash| {
                    hash.len() != 64 || !hash.bytes().all(|b| b.is_ascii_hexdigit())
                })
            {
                return Err(InvalidDispatchSnapshot);
            }
            Some(LocalScanReport::File(r.clone()))
        }
        Some(NativeScanReport::Directory(r)) => {
            if !matches(&r.job_id, &r.selection_ref)
                || r.findings.len() > MAX_REPORT_FINDINGS
                || r.findings.iter().any(|f| !valid_reference(&f.finding_ref))
                || snapshot
                    .progress
                    .as_ref()
                    .is_some_and(|p| p.progress != r.progress)
            {
                return Err(InvalidDispatchSnapshot);
            }
            Some(LocalScanReport::Directory(r.clone()))
        }
        None => None,
    };
    Ok(LocalScanSnapshot {
        ticket: LocalScanTicket {
            job_id: ticket.job_id.clone(),
            selection_ref: ticket.selection_ref.clone(),
        },
        state: snapshot.state,
        worker_returned: snapshot.worker_returned,
        abandoned: snapshot.abandoned,
        progress: snapshot.progress.clone(),
        report,
    })
}

/// Fixed path-free error codes; never pass raw worker diagnostics to the UI.
pub fn dispatch_error(error: DispatchError) -> LocalScanDispatchError {
    match error {
        DispatchError::Busy => LocalScanDispatchError::Busy,
        DispatchError::InvalidSelection => LocalScanDispatchError::InvalidSelection,
        DispatchError::InvalidDeadline => LocalScanDispatchError::InvalidDeadline,
        DispatchError::WrongOperation => LocalScanDispatchError::WrongOperation,
        DispatchError::Unavailable => LocalScanDispatchError::Unavailable,
        DispatchError::WorkerFailed => LocalScanDispatchError::WorkerFailed,
    }
}
