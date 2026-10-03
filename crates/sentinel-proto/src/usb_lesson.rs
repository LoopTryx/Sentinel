//! Educational-only USB interface scope DTOs; no policy/protection state.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum UsbLessonInterface {
    Storage,
    Input,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum UsbLessonScope {
    SelectedFileBytes,
    InputBehavior,
    FirmwareSafety,
    NothingMeasured,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum UsbLessonError {
    InvalidScenarioId,
    UnknownScenario,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct UsbLessonScenario {
    pub id: String,
    pub title: String,
    pub description: String,
    pub interfaces: Vec<UsbLessonInterface>,
    pub file_sample_checked: bool,
    pub synthetic: bool,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct UsbLessonFeedback {
    pub scenario_id: String,
    pub selected_scope: UsbLessonScope,
    pub recommended_scope: UsbLessonScope,
    pub correct: bool,
    pub explanation: String,
    pub limitation_keys: Vec<String>,
    pub safe_action: String,
    pub synthetic: bool,
}
