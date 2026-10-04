use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum DirectoryScanStage {
    Running,
    Finished,
}

/// Selected-directory traversal counters, not threat-detection coverage or a job.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export)]
pub struct DirectoryScanProgress {
    pub stage: DirectoryScanStage,
    #[serde(with = "decimal_u64")]
    #[ts(type = "string")]
    pub entries_visited: u64,
    #[serde(with = "decimal_u64")]
    #[ts(type = "string")]
    pub files_visited: u64,
    #[serde(with = "decimal_u64")]
    #[ts(type = "string")]
    pub files_checked: u64,
    #[serde(with = "decimal_u64")]
    #[ts(type = "string")]
    pub files_skipped: u64,
    #[serde(with = "decimal_u64")]
    #[ts(type = "string")]
    pub access_errors: u64,
    #[serde(with = "decimal_u64")]
    #[ts(type = "string")]
    pub engine_failures: u64,
    #[serde(with = "decimal_u64")]
    #[ts(type = "string")]
    pub bytes_read: u64,
    pub traversal_complete: bool,
    pub cancelled: bool,
    pub limit_reached: bool,
}

pub(crate) mod decimal_u64 {
    use serde::{Deserialize, Deserializer, Serializer, de::Error};
    pub fn serialize<S: Serializer>(value: &u64, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&value.to_string())
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u64, D::Error> {
        let text = String::deserialize(deserializer)?;
        if text.len() > 20 || text.is_empty() || !text.bytes().all(|b| b.is_ascii_digit()) {
            return Err(D::Error::custom("invalid scan counter"));
        }
        let value = text
            .parse::<u64>()
            .map_err(|_| D::Error::custom("invalid scan counter"))?;
        if value.to_string() != text {
            return Err(D::Error::custom("invalid scan counter"));
        }
        Ok(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn counters_roundtrip_full_width_and_reject_lossy_or_noncanonical_json() {
        let value = DirectoryScanProgress {
            stage: DirectoryScanStage::Running,
            entries_visited: u64::MAX,
            files_visited: 0,
            files_checked: 0,
            files_skipped: 0,
            access_errors: 0,
            engine_failures: 0,
            bytes_read: u64::MAX,
            traversal_complete: false,
            cancelled: false,
            limit_reached: false,
        };
        let json = serde_json::to_value(&value).unwrap();
        assert_eq!(json["bytesRead"], "18446744073709551615");
        assert_eq!(
            serde_json::from_value::<DirectoryScanProgress>(json.clone()).unwrap(),
            value
        );
        for invalid in [
            serde_json::json!(1),
            serde_json::json!("01"),
            serde_json::json!("-1"),
            serde_json::json!("18446744073709551616"),
            serde_json::json!(""),
            serde_json::json!("+1"),
        ] {
            let mut bad = json.clone();
            bad["bytesRead"] = invalid;
            assert!(serde_json::from_value::<DirectoryScanProgress>(bad).is_err());
        }
    }
}
