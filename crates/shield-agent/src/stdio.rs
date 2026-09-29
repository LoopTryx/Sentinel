use serde::Deserialize;
use shield_proto::rpc::{MAX_MESSAGE_BYTES, ProtocolVersion, encode_frame};
use shield_proto::status::StatusSnapshot;
use std::io::{Read, Write};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AgentError {
    Io,
    Truncated,
    Oversized,
    InvalidRequest,
    UnsupportedVersion,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    version: ProtocolVersion,
    method: Method,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum Method {
    StatusFixture,
}

pub fn serve_once<R: Read, W: Write>(reader: &mut R, writer: &mut W) -> Result<(), AgentError> {
    let mut header = [0u8; 4];
    reader.read_exact(&mut header).map_err(map_read_error)?;
    let length = u32::from_be_bytes(header) as usize;
    if length > MAX_MESSAGE_BYTES {
        return Err(AgentError::Oversized);
    }
    let mut payload = vec![0u8; length];
    reader.read_exact(&mut payload).map_err(map_read_error)?;
    let request: Request =
        serde_json::from_slice(&payload).map_err(|_| AgentError::InvalidRequest)?;
    ProtocolVersion::new(1, 0)
        .negotiate(request.version)
        .map_err(|_| AgentError::UnsupportedVersion)?;
    let status: StatusSnapshot = match request.method {
        Method::StatusFixture => {
            serde_json::from_str(include_str!("../../../data/fixtures/status.json"))
                .expect("checked-in fixture must match status contract")
        }
    };
    let encoded = serde_json::to_vec(&status).expect("status contract is serializable");
    let frame = encode_frame(&encoded).map_err(|_| AgentError::Oversized)?;
    writer.write_all(&frame).map_err(|_| AgentError::Io)
}

fn map_read_error(error: std::io::Error) -> AgentError {
    if error.kind() == std::io::ErrorKind::UnexpectedEof {
        AgentError::Truncated
    } else {
        AgentError::Io
    }
}
