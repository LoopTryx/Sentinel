use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum PasswordChoice {
    ReplacePredictable,
    MakeUnique,
    KeepUnique,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PasswordAutopsy {
    pub schema_version: u16,
    pub mode: String,
    pub scenario_id: String,
    pub example_description: String,
    pub observation: String,
    pub advice: String,
    pub limitation: String,
    pub choice: PasswordChoice,
    pub correct: bool,
    pub protection_verdict: bool,
    pub real_credentials_accepted: bool,
    pub network_accessed: bool,
}
