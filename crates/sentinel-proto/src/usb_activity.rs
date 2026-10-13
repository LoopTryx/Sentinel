//! Output-only input observation. References never authorize trust or blocking.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum UsbActivityMode {
    ObservationOnly,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum UsbActivityState {
    Observing,
    Partial,
    Unavailable,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UsbInputActivity {
    pub reference: String,
    pub kind: String,
    pub group_reference: Option<String>,
    pub placement: String,
    pub trusted: bool,
    pub held: bool,
    pub elapsed_seconds: u32,
    pub initial_observation_complete: bool,
    pub event_count: u32,
    pub launcher_shortcuts: u32,
    pub assessment: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UsbActivitySnapshot {
    pub schema_version: u8,
    pub mode: UsbActivityMode,
    pub state: UsbActivityState,
    pub hold_supported: bool,
    pub internal_exclusion_verified: bool,
    pub ignored_non_usb_interfaces: u32,
    pub omitted: u32,
    pub devices: Vec<UsbInputActivity>,
}
