use serde::Serialize;
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum FileScanOutcome {
    NoKnownFinding,
    TestSignatureFound,
    SkippedLimit,
    SkippedUnsupported,
    AccessError,
    ChangedDuringScan,
    Cancelled,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ScanReportCoverage {
    Partial,
}

/// Output-only selected-file evidence. Correlation is not authorization.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SelectedFileReport {
    pub job_id: String,
    pub selection_ref: String,
    pub state: FileScanOutcome,
    pub coverage: ScanReportCoverage,
    #[serde(with = "super::scan_progress::decimal_u64")]
    #[ts(type = "string")]
    pub bytes_read: u64,
    pub sha256: Option<String>,
    #[serde(with = "super::scan_progress::decimal_u64")]
    #[ts(type = "string")]
    pub files_visited: u64,
    #[serde(with = "super::scan_progress::decimal_u64")]
    #[ts(type = "string")]
    pub files_checked: u64,
    #[serde(with = "super::scan_progress::decimal_u64")]
    #[ts(type = "string")]
    pub files_skipped: u64,
    #[serde(with = "super::scan_progress::decimal_u64")]
    #[ts(type = "string")]
    pub access_errors: u64,
    #[serde(with = "super::scan_progress::decimal_u64")]
    #[ts(type = "string")]
    pub engine_failures: u64,
    pub full_signature_engine_active: bool,
}
