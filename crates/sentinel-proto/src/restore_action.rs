//! Native receipt-bound restore correlation. No destination or approval input.
use crate::quarantine_action::{InvalidQuarantineAction, QuarantineReceipt, QuarantineResultState};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RestorePrepareRequest {
    pub quarantine_action_ref: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RestoreActionReference {
    pub restore_ref: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RestorePreview {
    pub restore_ref: String,
    pub quarantine: QuarantineReceipt,
    pub expires_after_seconds: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum RestoreResultState {
    Restored,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RestoreReceipt {
    pub restore_ref: String,
    pub quarantine: QuarantineReceipt,
    pub state: RestoreResultState,
}

fn reference(value: &str) -> Result<(), InvalidQuarantineAction> {
    crate::selected_scan::reference(value).map_err(|_| InvalidQuarantineAction)
}
fn quarantine(value: &QuarantineReceipt) -> Result<(), InvalidQuarantineAction> {
    value.validate()?;
    if value.state != QuarantineResultState::Quarantined {
        return Err(InvalidQuarantineAction);
    }
    Ok(())
}
impl RestorePrepareRequest {
    pub fn validate(&self) -> Result<(), InvalidQuarantineAction> {
        reference(&self.quarantine_action_ref)
    }
}
impl RestoreActionReference {
    pub fn validate(&self) -> Result<(), InvalidQuarantineAction> {
        reference(&self.restore_ref)
    }
}
impl RestorePreview {
    pub fn validate(&self) -> Result<(), InvalidQuarantineAction> {
        reference(&self.restore_ref)?;
        quarantine(&self.quarantine)?;
        if self.expires_after_seconds != 30 {
            return Err(InvalidQuarantineAction);
        }
        Ok(())
    }
}
impl RestoreReceipt {
    pub fn validate(&self) -> Result<(), InvalidQuarantineAction> {
        reference(&self.restore_ref)?;
        quarantine(&self.quarantine)
    }
}
