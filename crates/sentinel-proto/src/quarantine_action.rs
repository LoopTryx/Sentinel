//! Path-free correlation only. Approval, caller identity, time and inspected
//! object associations are trusted native state, never request fields.
use crate::file_inspection::{FileInspectionSnapshot, FileInspectionState};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuarantinePrepareRequest {
    pub job_ref: String,
    pub report_ref: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuarantineActionReference {
    pub action_ref: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuarantinePreview {
    pub action_ref: String,
    pub selection_ref: String,
    pub job_ref: String,
    pub report_ref: String,
    /// Display hint; native monotonic state determines actual expiry.
    pub expires_after_seconds: u32,
    pub inspection: FileInspectionSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum QuarantineResultState {
    Quarantined,
    OriginalRetained,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuarantineReceipt {
    pub action_ref: String,
    pub selection_ref: String,
    pub job_ref: String,
    pub report_ref: String,
    /// Opaque private-vault reference, never a pathname or restore authority.
    pub vault_file: String,
    pub state: QuarantineResultState,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum QuarantineErrorCode {
    Unavailable,
    Busy,
    InvalidRequest,
    JobUnavailable,
    ReportUnavailable,
    ActionUnavailable,
    Declined,
    ActionFailed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuarantineError {
    pub code: QuarantineErrorCode,
}

#[derive(Debug, PartialEq, Eq)]
pub struct InvalidQuarantineAction;

fn reference(value: &str) -> Result<(), InvalidQuarantineAction> {
    crate::selected_scan::reference(value).map_err(|_| InvalidQuarantineAction)
}

pub fn report_index(value: &str) -> Result<usize, InvalidQuarantineAction> {
    let index = value
        .strip_prefix("report_")
        .ok_or(InvalidQuarantineAction)?;
    if index.is_empty()
        || index.len() > 2
        || !index.bytes().all(|byte| byte.is_ascii_digit())
        || (index.len() > 1 && index.starts_with('0'))
    {
        return Err(InvalidQuarantineAction);
    }
    let index = index
        .parse::<usize>()
        .map_err(|_| InvalidQuarantineAction)?;
    if index > 64 {
        return Err(InvalidQuarantineAction);
    }
    Ok(index)
}

impl QuarantinePrepareRequest {
    pub fn validate(&self) -> Result<(), InvalidQuarantineAction> {
        reference(&self.job_ref)?;
        report_index(&self.report_ref)?;
        Ok(())
    }
}
impl QuarantineActionReference {
    pub fn validate(&self) -> Result<(), InvalidQuarantineAction> {
        reference(&self.action_ref)
    }
}
impl QuarantinePreview {
    pub fn validate(&self) -> Result<(), InvalidQuarantineAction> {
        reference(&self.action_ref)?;
        reference(&self.selection_ref)?;
        reference(&self.job_ref)?;
        report_index(&self.report_ref)?;
        self.inspection
            .validate()
            .map_err(|_| InvalidQuarantineAction)?;
        if self.expires_after_seconds != 30
            || self.inspection.report_ref != self.report_ref
            || self.inspection.state != FileInspectionState::Completed
            || self.inspection.sha256.is_none()
            || self.inspection.logical_bytes != self.inspection.inspected_bytes
        {
            return Err(InvalidQuarantineAction);
        }
        Ok(())
    }
}
impl QuarantineReceipt {
    pub fn validate(&self) -> Result<(), InvalidQuarantineAction> {
        reference(&self.action_ref)?;
        reference(&self.selection_ref)?;
        reference(&self.job_ref)?;
        report_index(&self.report_ref)?;
        let name = self
            .vault_file
            .strip_suffix(".qtn")
            .ok_or(InvalidQuarantineAction)?;
        if name.len() != 32
            || !name
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err(InvalidQuarantineAction);
        }
        Ok(())
    }
}
