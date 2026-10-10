use crate::assessment::Coverage;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum FileInspectionState {
    Completed,
    Partial,
    Cancelled,
    TimedOut,
    Busy,
    Unsupported,
    AccessError,
    Changed,
    EngineFailed,
    LimitReached,
    DepthLimit,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum FileInspectionVerdict {
    NoneObserved,
    Suspicious,
    SignatureMatch,
    SyntheticTest,
    Unknown,
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum FileInspectionFinding {
    HashSignature,
    SyntheticMarker,
    ScriptIndicators,
    RansomNoteIndicators,
    AutorunIndicators,
    DisguisedFilename,
    HighEntropyExecutable,
    LargeZeroFilledRange,
    DisguisedExecutableHeader,
    OtherLocalIndicator,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InspectedByteEvidence {
    pub zero_bytes: String,
    pub zero_permille: u16,
    pub range_complete: bool,
    pub pe_header_present: bool,
}

/// Path-free output only. References correlate results; they authorize nothing.
/// Decimal strings preserve all u64 counters in JavaScript.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FileInspectionSnapshot {
    pub report_ref: String,
    pub state: FileInspectionState,
    pub verdict: FileInspectionVerdict,
    pub coverage: Coverage,
    pub logical_bytes: String,
    pub inspected_bytes: String,
    pub sha256: Option<String>,
    pub evidence: Option<InspectedByteEvidence>,
    pub findings: Vec<FileInspectionFinding>,
}

#[derive(Debug, PartialEq, Eq)]
pub struct InvalidFileInspection;

impl FileInspectionSnapshot {
    pub fn validate(&self) -> Result<(), InvalidFileInspection> {
        let logical = decimal(&self.logical_bytes)?;
        let inspected = decimal(&self.inspected_bytes)?;
        if self.report_ref.is_empty()
            || self.report_ref.len() > 64
            || !self
                .report_ref
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
            || inspected > logical
            || inspected > 8 * 1024 * 1024
            || self.findings.len() > 64
            || self
                .findings
                .iter()
                .collect::<std::collections::BTreeSet<_>>()
                .len()
                != self.findings.len()
            || self.coverage == Coverage::Complete
        {
            return Err(InvalidFileInspection);
        }
        if let Some(hash) = &self.sha256
            && (hash.len() != 64
                || !hash
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
                || inspected != logical)
        {
            return Err(InvalidFileInspection);
        }
        match &self.evidence {
            Some(evidence) => {
                let zero = decimal(&evidence.zero_bytes)?;
                let ratio = if inspected == 0 {
                    0
                } else {
                    (u128::from(zero) * 1000 / u128::from(inspected)) as u16
                };
                if zero > inspected
                    || evidence.zero_permille > 1000
                    || evidence.zero_permille != ratio
                    || evidence.range_complete != (inspected == logical)
                    || (evidence.pe_header_present && inspected < 68)
                    || self.coverage != Coverage::Partial
                {
                    return Err(InvalidFileInspection);
                }
            }
            None => {
                if inspected != 0 || self.coverage != Coverage::Unavailable || self.sha256.is_some()
                {
                    return Err(InvalidFileInspection);
                }
            }
        }
        if self.state == FileInspectionState::Completed
            && (self.evidence.is_none() || inspected != logical || self.sha256.is_none())
        {
            return Err(InvalidFileInspection);
        }
        if self.state == FileInspectionState::Partial
            && (self.evidence.is_none() || inspected >= logical)
        {
            return Err(InvalidFileInspection);
        }
        for finding in &self.findings {
            let evidence = self.evidence.as_ref().ok_or(InvalidFileInspection)?;
            if (inspected == 0 && finding != &FileInspectionFinding::DisguisedFilename)
                || (finding == &FileInspectionFinding::LargeZeroFilledRange
                    && (logical < 64 * 1024 * 1024
                        || inspected < 4096
                        || evidence.zero_permille < 950))
                || (finding == &FileInspectionFinding::DisguisedExecutableHeader
                    && !evidence.pe_header_present)
                || (finding == &FileInspectionFinding::HashSignature && self.sha256.is_none())
            {
                return Err(InvalidFileInspection);
            }
        }
        match self.verdict {
            FileInspectionVerdict::NoneObserved
                if self.state != FileInspectionState::Completed || !self.findings.is_empty() =>
            {
                return Err(InvalidFileInspection);
            }
            FileInspectionVerdict::Suspicious if self.findings.is_empty() => {
                return Err(InvalidFileInspection);
            }
            FileInspectionVerdict::SignatureMatch
                if !self
                    .findings
                    .contains(&FileInspectionFinding::HashSignature) =>
            {
                return Err(InvalidFileInspection);
            }
            FileInspectionVerdict::SyntheticTest
                if !self
                    .findings
                    .contains(&FileInspectionFinding::SyntheticMarker) =>
            {
                return Err(InvalidFileInspection);
            }
            _ => {}
        }
        Ok(())
    }
}

fn decimal(value: &str) -> Result<u64, InvalidFileInspection> {
    if value.is_empty()
        || value.len() > 20
        || !value.bytes().all(|byte| byte.is_ascii_digit())
        || (value.len() > 1 && value.starts_with('0'))
    {
        return Err(InvalidFileInspection);
    }
    value.parse().map_err(|_| InvalidFileInspection)
}
