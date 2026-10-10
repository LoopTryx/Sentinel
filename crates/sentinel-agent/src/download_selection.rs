//! Bounded decoding only; never authorizes a file, approval, job or native RPC.
use sentinel_proto::download_selection::DownloadObservation;

const MAX_OBSERVATION_BYTES: usize = 512;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DownloadIngressError {
    TooLarge,
    InvalidObservation,
}

/// Decode an already-framed correlation payload with a fixed parse budget.
/// The transport must separately bound frames before allocation and authenticate
/// the session. Success proves neither completion nor filesystem access.
pub fn decode_download_observation(
    bytes: &[u8],
) -> Result<DownloadObservation, DownloadIngressError> {
    if bytes.len() > MAX_OBSERVATION_BYTES {
        return Err(DownloadIngressError::TooLarge);
    }
    // Serde structs also accept positional arrays; this wire contract requires
    // an object with named references so positional input cannot bypass it.
    if bytes
        .iter()
        .find(|byte| !matches!(**byte, b' ' | b'\t' | b'\r' | b'\n'))
        != Some(&b'{')
    {
        return Err(DownloadIngressError::InvalidObservation);
    }
    let observation: DownloadObservation =
        serde_json::from_slice(bytes).map_err(|_| DownloadIngressError::InvalidObservation)?;
    observation
        .validate()
        .map_err(|_| DownloadIngressError::InvalidObservation)?;
    Ok(observation)
}
