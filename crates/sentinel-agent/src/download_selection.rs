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

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

#[derive(Default)]
struct Accounting {
    next: u64,
    charges: HashMap<u64, (String, u64)>,
}
static ACCOUNTING: OnceLock<Mutex<Accounting>> = OnceLock::new();

/// Accounting only. Not approval, identity, a file handle or permission.
/// Dropping/forgetting this ticket deliberately keeps its charge fail-closed.
pub struct DownloadAccountingTicket {
    id: u64,
}
impl std::fmt::Debug for DownloadAccountingTicket {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("DownloadAccountingTicket (redacted)")
    }
}

/// Trusted native broker only. Owner identity must come from authentication,
/// never a browser correlation. Check and charge share one process-global lock.
pub fn reserve_download_accounting(
    trusted_owner: &str,
    file_bytes: u64,
) -> Result<DownloadAccountingTicket, DownloadReservationError> {
    if trusted_owner.is_empty()
        || trusted_owner.len() > 64
        || !trusted_owner
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err(DownloadReservationError::InvalidUsage);
    }
    let mut state = ACCOUNTING
        .get_or_init(|| Mutex::new(Accounting::default()))
        .lock()
        .map_err(|_| DownloadReservationError::InvalidUsage)?;
    let owner_count = state
        .charges
        .values()
        .filter(|(owner, _)| owner == trusted_owner)
        .count();
    let bytes = state.charges.values().map(|(_, bytes)| bytes).sum();
    check_download_reservation(owner_count, state.charges.len(), bytes, file_bytes)?;
    let id = state
        .next
        .checked_add(1)
        .ok_or(DownloadReservationError::InvalidUsage)?;
    state.next = id;
    state
        .charges
        .insert(id, (trusted_owner.to_owned(), file_bytes));
    Ok(DownloadAccountingTicket { id })
}

impl DownloadAccountingTicket {
    /// Caller must perform actual trusted cleanup in the closure. Failure returns
    /// the same non-clonable ticket for retry, preserving capacity charges.
    /// Panic or dropped ticket also preserves charges. No OS cleanup is supplied.
    pub fn release_with_cleanup(
        self,
        cleanup: impl FnOnce() -> Result<(), ()>,
    ) -> Result<(), Self> {
        if cleanup().is_err() {
            return Err(self);
        }
        let Ok(mut state) = ACCOUNTING
            .get_or_init(|| Mutex::new(Accounting::default()))
            .lock()
        else {
            return Err(self);
        };
        if state.charges.remove(&self.id).is_none() {
            return Err(self);
        }
        Ok(())
    }
}
