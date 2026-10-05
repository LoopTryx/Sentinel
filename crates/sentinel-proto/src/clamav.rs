//! Output-only optional engine evidence. No permission or scan request contract.
use crate::assessment::Coverage;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ClamAvState {
    NoKnownFinding,
    SignatureMatch,
    InspectionIncomplete,
    Unavailable,
    Failed,
    TimedOut,
    Cancelled,
    SourceChanged,
    Busy,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export)]
pub struct ClamAvReport {
    pub state: ClamAvState,
    pub coverage: Coverage,
}
