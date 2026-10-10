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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DownloadReservationError {
    TooLarge,
    Capacity,
    InvalidUsage,
}

/// Pure policy preflight, not reservation, authentication or resource authority.
/// A future broker must read/check/update trusted usage under ONE shared lock,
/// retain the charge across inspection and release only after resource cleanup.
/// Browser input must never supply these usage counters.
pub fn check_download_reservation(
    owner_approvals: usize,
    global_approvals: usize,
    global_reserved_bytes: u64,
    file_bytes: u64,
) -> Result<(), DownloadReservationError> {
    const MAX_FILE: u64 = 8 * 1024 * 1024;
    const MAX_BYTES: u64 = 32 * MAX_FILE;
    if owner_approvals > global_approvals
        || owner_approvals > 8
        || global_approvals > 32
        || global_reserved_bytes > MAX_BYTES
        || global_reserved_bytes > global_approvals as u64 * MAX_FILE
    {
        return Err(DownloadReservationError::InvalidUsage);
    }
    if file_bytes > MAX_FILE {
        return Err(DownloadReservationError::TooLarge);
    }
    if owner_approvals == 8
        || global_approvals == 32
        || file_bytes > MAX_BYTES - global_reserved_bytes
    {
        return Err(DownloadReservationError::Capacity);
    }
    Ok(())
}
