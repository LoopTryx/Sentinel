//! Fixed redacted activity evidence, not a browser authority or RPC method.
use serde::{Deserialize, Serialize};
use ts_rs::TS;
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum BrowserActivityKind {
    NavigationHeld,
    PotentiallyHarmful,
    InspectionUnavailable,
    ContinuedOnce,
    Dismissed,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export)]
pub struct BrowserActivityEvent {
    pub session_ref: String,
    pub sequence: u32,
    pub navigation_ref: String,
    pub assessment_ref: String,
    pub kind: BrowserActivityKind,
}
