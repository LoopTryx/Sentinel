//! Trusted native-session lifecycle only; no authentication, transport or dispatch.
use crate::native_request::NativeRequest;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

const MAX_PENDING: usize = 32;
const MAX_SESSION_REQUESTS: usize = 256;
const DEADLINE: Duration = Duration::from_secs(5);
static NEXT_SESSION: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, PartialEq, Eq)]
pub enum PendingError {
    Closed,
    Foreign,
    Unknown,
    Expired,
    Replay,
    Busy,
    SessionBudget,
    InvalidId,
    ClockRollback,
    Unavailable,
}

/// Opaque and process-session-bound; cloning never grants another completion.
#[derive(Clone)]
pub struct PendingTicket {
    session: u64,
    id: String,
}
impl std::fmt::Debug for PendingTicket {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("PendingTicket (reference redacted)")
    }
}

pub struct PendingRequests {
    session: u64,
    pending: HashMap<String, Instant>,
    seen: HashSet<String>,
    last_now: Instant,
    closed: bool,
}
impl std::fmt::Debug for PendingRequests {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PendingRequests")
            .field("pending_count", &self.pending.len())
            .field("closed", &self.closed)
            .finish_non_exhaustive()
    }
}
impl PendingRequests {
    /// Create after authenticating the host session. Counter exhaustion fails closed.
    pub fn new(now: Instant) -> Result<Self, PendingError> {
        let session = NEXT_SESSION
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |n| n.checked_add(1))
            .map_err(|_| PendingError::Unavailable)?;
        Ok(Self {
            session,
            pending: HashMap::new(),
            seen: HashSet::new(),
            last_now: now,
            closed: false,
        })
    }

    fn advance(&mut self, now: Instant) -> Result<(), PendingError> {
        if self.closed {
            return Err(PendingError::Closed);
        }
        if now < self.last_now {
            return Err(PendingError::ClockRollback);
        }
        self.last_now = now;
        Ok(())
    }

    /// Accept a validated request; only its bounded correlation ID is retained.
    /// Host-owned time must never come from an incoming request.
    pub fn admit(
        &mut self,
        request: &NativeRequest,
        now: Instant,
    ) -> Result<PendingTicket, PendingError> {
        self.advance(now)?;
        let id = match request {
            NativeRequest::Capabilities { id } | NativeRequest::Url { id, .. } => id,
        };
        if id.is_empty()
            || id.len() > 128
            || !id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            return Err(PendingError::InvalidId);
        }
        if self.seen.contains(id) {
            return Err(PendingError::Replay);
        }
        if self.pending.len() == MAX_PENDING {
            return Err(PendingError::Busy);
        }
        if self.seen.len() == MAX_SESSION_REQUESTS {
            return Err(PendingError::SessionBudget);
        }
        let deadline = now.checked_add(DEADLINE).ok_or(PendingError::Unavailable)?;
        self.seen.insert(id.clone());
        self.pending.insert(id.clone(), deadline);
        Ok(PendingTicket {
            session: self.session,
            id: id.clone(),
        })
    }

    /// Return correlation only if this session still authorizes an on-time reply.
    /// Call before delivering a result. This does not stop the underlying work.
    pub fn complete(
        &mut self,
        ticket: PendingTicket,
        now: Instant,
    ) -> Result<String, PendingError> {
        if self.closed {
            return Err(PendingError::Closed);
        }
        if ticket.session != self.session {
            return Err(PendingError::Foreign);
        }
        self.advance(now)?;
        let deadline = self
            .pending
            .remove(&ticket.id)
            .ok_or(PendingError::Unknown)?;
        if now >= deadline {
            return Err(PendingError::Expired);
        }
        Ok(ticket.id)
    }

    /// Invalidate this pending reply after a trusted dismissal or subject change.
    /// This consumes the ticket but neither stops work nor authorizes a wire reply.
    /// Replay history and the session budget remain sealed, including after expiry.
    pub fn cancel(&mut self, ticket: PendingTicket, now: Instant) -> Result<(), PendingError> {
        self.complete(ticket, now).map(|_| ())
    }
    /// Poll from the host's timer, then emit timeout responses for these IDs.
    /// Replay history stays sealed. At most 32 correlations are returned.
    pub fn expire(&mut self, now: Instant) -> Result<Vec<String>, PendingError> {
        self.advance(now)?;
        let mut expired = Vec::new();
        self.pending.retain(|id, deadline| {
            if now >= *deadline {
                expired.push(id.clone());
                false
            } else {
                true
            }
        });
        expired.sort();
        Ok(expired)
    }

    pub fn pending_count(&self) -> usize {
        self.pending.len()
    }

    /// Irreversible. A reconnect needs a separately authenticated new instance.
    pub fn disconnect(&mut self) {
        self.closed = true;
        self.pending.clear();
        self.seen.clear();
    }
}
