//! Output-only local native adapter contracts; no RPC endpoint or authority.
use crate::scan_report::{
    BoundDirectoryProgress, LocalScanControlState, SelectedDirectoryReport, SelectedFileReport,
};
use serde::Serialize;
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct LocalScanTicket {
    pub job_id: String,
    pub selection_ref: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(tag = "kind", content = "data", rename_all = "snake_case")]
#[ts(export)]
pub enum LocalScanReport {
    File(SelectedFileReport),
    Directory(SelectedDirectoryReport),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct LocalScanSnapshot {
    pub ticket: LocalScanTicket,
    pub state: LocalScanControlState,
    pub worker_returned: bool,
    pub abandoned: bool,
    pub progress: Option<BoundDirectoryProgress>,
    pub report: Option<LocalScanReport>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum LocalScanDispatchError {
    Busy,
    InvalidSelection,
    InvalidDeadline,
    WrongOperation,
    Unavailable,
    WorkerFailed,
    InvalidSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(tag = "status", content = "data", rename_all = "snake_case")]
#[ts(export)]
pub enum LocalScanPollResponse {
    Snapshot(Box<LocalScanSnapshot>),
    Error(LocalScanDispatchError),
}
