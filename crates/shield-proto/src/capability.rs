use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityState {
    Proven,
    Partial,
    Unavailable,
    Untested,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityStatus {
    pub id: String,
    pub state: CapabilityState,
    pub reason_key: String,
    pub observed_at: Option<String>,
    pub evidence_refs: Vec<String>,
}
