//! Canonical selected-scan wire types. References correlate private native state;
//! they are not path authority. No caller identity or native clock is client input.
use crate::file_inspection::FileInspectionSnapshot;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum ScanSelectionKind {
    File,
    Directory,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScanSelectRequest {
    pub kind: ScanSelectionKind,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScanSelection {
    pub selection_ref: String,
    pub kind: ScanSelectionKind,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScanStartRequest {
    pub selection_ref: String,
}

/// Input to poll/cancel; output from start. Native derives the caller separately.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScanJobReference {
    pub job_ref: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScanCancelResponse {
    pub job_ref: String,
    pub cancellation_requested: bool,
}

/// Finished means worker exit, never complete coverage or safety.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum ScanWorkerState {
    Running,
    Finished,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScanJobSnapshot {
    pub selection_ref: String,
    pub job_ref: String,
    pub state: ScanWorkerState,
    pub cancellation_requested: bool,
    /// Latest file's acquired bytes, not aggregate/validated inspection coverage.
    pub current_file_bytes: String,
    pub reports: Vec<FileInspectionSnapshot>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum ScanErrorCode {
    Unavailable,
    Busy,
    InvalidRequest,
    SelectionUnavailable,
    JobUnavailable,
    InspectionUnavailable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScanError {
    pub code: ScanErrorCode,
}

#[derive(Debug, PartialEq, Eq)]
pub struct InvalidSelectedScan;

pub(crate) fn reference(value: &str) -> Result<(), InvalidSelectedScan> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
    {
        return Err(InvalidSelectedScan);
    }
    Ok(())
}

impl ScanSelection {
    pub fn validate(&self) -> Result<(), InvalidSelectedScan> {
        reference(&self.selection_ref)
    }
}
impl ScanStartRequest {
    pub fn validate(&self) -> Result<(), InvalidSelectedScan> {
        reference(&self.selection_ref)
    }
}
impl ScanJobReference {
    pub fn validate(&self) -> Result<(), InvalidSelectedScan> {
        reference(&self.job_ref)
    }
}
impl ScanCancelResponse {
    pub fn validate(&self) -> Result<(), InvalidSelectedScan> {
        reference(&self.job_ref)
    }
}
impl ScanJobSnapshot {
    pub fn validate(&self) -> Result<(), InvalidSelectedScan> {
        reference(&self.selection_ref)?;
        reference(&self.job_ref)?;
        let bytes = &self.current_file_bytes;
        if bytes.is_empty()
            || bytes.len() > 20
            || !bytes.bytes().all(|byte| byte.is_ascii_digit())
            || (bytes.len() > 1 && bytes.starts_with('0'))
            || bytes
                .parse::<u64>()
                .map_or(true, |value| value > 8 * 1024 * 1024)
            || self.reports.len() > 65
        {
            return Err(InvalidSelectedScan);
        }
        let mut references = std::collections::BTreeSet::new();
        for report in &self.reports {
            report.validate().map_err(|_| InvalidSelectedScan)?;
            if !references.insert(&report.report_ref) {
                return Err(InvalidSelectedScan);
            }
        }
        Ok(())
    }
}
