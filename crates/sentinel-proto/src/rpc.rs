use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const MAX_MESSAGE_BYTES: usize = 1_048_576;
const FRAME_HEADER_BYTES: usize = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum RpcMethod {
    #[serde(rename = "capabilities.list")]
    CapabilitiesList,
    #[serde(rename = "scan.start")]
    ScanStart,
    #[serde(rename = "jobs.get")]
    JobsGet,
    #[serde(rename = "jobs.cancel")]
    JobsCancel,
    #[serde(rename = "assessment.get")]
    AssessmentGet,
    #[serde(rename = "usb.list")]
    UsbList,
    #[serde(rename = "usb.policy.preview")]
    UsbPolicyPreview,
    #[serde(rename = "usb.policy.apply")]
    UsbPolicyApply,
    #[serde(rename = "usb.policy.revert")]
    UsbPolicyRevert,
    #[serde(rename = "wifi.assess")]
    WifiAssess,
    #[serde(rename = "quarantine.restore")]
    QuarantineRestore,
    #[serde(rename = "vault.unlock")]
    VaultUnlock,
    #[serde(rename = "vault.fill")]
    VaultFill,
    #[serde(rename = "awareness.next")]
    AwarenessNext,
    #[serde(rename = "settings.update")]
    SettingsUpdate,
    #[serde(rename = "url.assess")]
    UrlAssess,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FrameError {
    Truncated,
    TrailingBytes,
    Oversized,
}

pub fn encode_frame(payload: &[u8]) -> Result<Vec<u8>, FrameError> {
    if payload.len() > MAX_MESSAGE_BYTES {
        return Err(FrameError::Oversized);
    }
    let mut frame = Vec::with_capacity(FRAME_HEADER_BYTES + payload.len());
    frame.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    frame.extend_from_slice(payload);
    Ok(frame)
}

pub fn decode_frame(frame: &[u8]) -> Result<&[u8], FrameError> {
    let header: [u8; FRAME_HEADER_BYTES] = frame
        .get(..FRAME_HEADER_BYTES)
        .ok_or(FrameError::Truncated)?
        .try_into()
        .expect("slice length was checked");
    let length = u32::from_be_bytes(header) as usize;
    if length > MAX_MESSAGE_BYTES {
        return Err(FrameError::Oversized);
    }
    let expected = FRAME_HEADER_BYTES + length;
    if frame.len() < expected {
        return Err(FrameError::Truncated);
    }
    if frame.len() > expected {
        return Err(FrameError::TrailingBytes);
    }
    Ok(&frame[FRAME_HEADER_BYTES..])
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolVersion {
    pub major: u16,
    pub minor: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProtocolError {
    MajorMismatch,
}

impl ProtocolVersion {
    pub const fn new(major: u16, minor: u16) -> Self {
        Self { major, minor }
    }

    pub fn negotiate(self, peer: Self) -> Result<Self, ProtocolError> {
        if self.major != peer.major {
            return Err(ProtocolError::MajorMismatch);
        }
        Ok(Self::new(self.major, self.minor.min(peer.minor)))
    }
}
