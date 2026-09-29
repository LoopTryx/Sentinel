use crate::assessment::Assessment;
use crate::capability::CapabilityStatus;
use crate::jobs::Job;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum StatusMode {
    Fixture,
    Live,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct StatusSnapshot {
    pub mode: StatusMode,
    pub assessment: Assessment,
    pub capabilities: Vec<CapabilityStatus>,
    pub job: Option<Job>,
}
