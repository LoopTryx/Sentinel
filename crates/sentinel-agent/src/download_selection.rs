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
    let observation: DownloadObservation =
        serde_json::from_slice(bytes).map_err(|_| DownloadIngressError::InvalidObservation)?;
    observation
        .validate()
        .map_err(|_| DownloadIngressError::InvalidObservation)?;
    Ok(observation)
}
