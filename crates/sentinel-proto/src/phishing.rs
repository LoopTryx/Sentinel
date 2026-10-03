//! Educational scenario DTOs, separate from protection assessments.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum PhishingChoice {
    FollowRequest,
    VerifySeparately,
    Ignore,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum PhishingError {
    InvalidScenarioId,
    UnknownScenario,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct PhishingScenario {
    pub id: String,
    pub title: String,
    pub message: String,
    pub synthetic: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct PhishingFeedback {
    pub scenario_id: String,
    pub selected_choice: PhishingChoice,
    pub correct: bool,
    pub clue_keys: Vec<String>,
    pub explanation: String,
    pub safe_action: String,
    pub synthetic: bool,
}
