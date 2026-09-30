use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub provider_requests_enabled: bool,
    pub usb_policy_enabled: bool,
    pub activity_retention_days: u16,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ConfigError {
    InvalidRetention,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            provider_requests_enabled: false,
            usb_policy_enabled: false,
            activity_retention_days: 30,
        }
    }
}

impl Config {
    pub fn validate(&self) -> Result<(), ConfigError> {
        if !(1..=365).contains(&self.activity_retention_days) {
            return Err(ConfigError::InvalidRetention);
        }
        Ok(())
    }
}
