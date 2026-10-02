//! Chrome framing on the supported Windows platform; distinct from internal RPC.
use crate::rpc::{FrameError, MAX_MESSAGE_BYTES};
use std::io::Read;

pub fn encode_chrome_frame(payload: &[u8]) -> Result<Vec<u8>, crate::rpc::FrameError> {
    if payload.len() > MAX_MESSAGE_BYTES {
        return Err(FrameError::Oversized);
    }
    let mut frame = Vec::with_capacity(4 + payload.len());
    frame.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    frame.extend_from_slice(payload);
    Ok(frame)
}
pub fn decode_chrome_frame(frame: &[u8]) -> Result<&[u8], crate::rpc::FrameError> {
    let header: [u8; 4] = frame
        .get(..4)
        .ok_or(FrameError::Truncated)?
        .try_into()
        .unwrap();
    let length = checked_length(header)?;
    if frame.len() < 4 + length {
        return Err(FrameError::Truncated);
    }
    if frame.len() > 4 + length {
        return Err(FrameError::TrailingBytes);
    }
    Ok(&frame[4..])
}

#[derive(Debug)]
pub enum NativeReadError {
    Io(std::io::Error),
    Frame(FrameError),
    InvalidJson,
}

/// Reads one frame only; the host owns transport deadlines and envelope validation.
/// Errors carry no request ID. Body bytes are not read until the header is bounded.
pub fn read_chrome_json(reader: &mut impl Read) -> Result<serde_json::Value, NativeReadError> {
    let mut header = [0; 4];
    reader
        .read_exact(&mut header)
        .map_err(NativeReadError::Io)?;
    let length = checked_length(header).map_err(NativeReadError::Frame)?;
    let mut payload = vec![0; length];
    reader
        .read_exact(&mut payload)
        .map_err(NativeReadError::Io)?;
    serde_json::from_slice(&payload).map_err(|_| NativeReadError::InvalidJson)
}

fn checked_length(header: [u8; 4]) -> Result<usize, FrameError> {
    let length = u32::from_le_bytes(header) as usize;
    if length > MAX_MESSAGE_BYTES {
        Err(FrameError::Oversized)
    } else {
        Ok(length)
    }
}
