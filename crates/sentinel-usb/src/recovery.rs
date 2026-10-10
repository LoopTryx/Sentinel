//! Recovery protocol only. No registry, device or filesystem mutation provider.
//! Production Store must be private, bounded, crash-durable and exclusive.
//! Production Backend must scope changes narrowly, compare prior/owned state and
//! reject unrelated drift. Implementing these traits is not hardware evidence.
const MAX_RECORD: usize = 4096;
const HEADER: usize = 24;
const MAGIC: &[u8; 8] = b"SNTUSB01";
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    Invalid,
    Busy,
    Store,
    Platform,
    Conflict,
    Corrupt,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum State {
    Idle,
    Armed,
    Applied,
    RecoveryRequired,
}
pub trait Store {
    /// Persist+sync before returning success; failed writes may still leave intent.
    fn persist(&mut self, record: &[u8]) -> Result<(), Error>;
    fn load_into(&mut self, record: &mut [u8]) -> Result<Option<usize>, Error>;
    /// Clear+sync; retries must tolerate prior restoration already succeeding.
    fn clear(&mut self) -> Result<(), Error>;
}
pub trait Backend {
    fn capture_into(&mut self, prior: &mut [u8]) -> Result<usize, Error>;
    /// Must compare the current baseline again before a narrowly owned mutation.
    fn apply_if_unchanged(&mut self, prior: &[u8]) -> Result<(), Error>;
    fn verify_applied(&mut self) -> Result<(), Error>;
    /// Idempotently restore only this owned change; unrelated drift is Conflict.
    fn restore_if_owned(&mut self, prior: &[u8]) -> Result<(), Error>;
    fn verify_restored(&mut self, prior: &[u8]) -> Result<(), Error>;
}
pub struct Recovery<S: Store, B: Backend> {
    store: S,
    backend: B,
    state: State,
}
impl<S: Store, B: Backend> Recovery<S, B> {
    pub fn new(store: S, backend: B) -> Self {
        Self {
            store,
            backend,
            state: State::RecoveryRequired,
        }
    }
    pub fn state(&self) -> State {
        self.state
    }
    /// Run before enabling a new policy on every service start.
    pub fn recover_pending(&mut self) -> Result<bool, Error> {
        self.recover(None)
    }
    /// Independent watchdog must run this even if the UI/service is unavailable.
    /// A backwards wall clock triggers recovery rather than extending the lease.
    pub fn recover_due(&mut self, now: u64) -> Result<bool, Error> {
        self.recover(Some(now))
    }
    fn recover(&mut self, now: Option<u64>) -> Result<bool, Error> {
        self.state = State::RecoveryRequired;
        let mut record = [0; MAX_RECORD];
        let Some(length) = self
            .store
            .load_into(&mut record)
            .map_err(|_| Error::Store)?
        else {
            self.state = State::Idle;
            return Ok(false);
        };
        if !(HEADER + 1..=MAX_RECORD).contains(&length) {
            return Err(Error::Corrupt);
        }
        if &record[..8] != MAGIC {
            return Err(Error::Corrupt);
        }
        let issued = u64::from_le_bytes(record[8..16].try_into().map_err(|_| Error::Corrupt)?);
        let expires =
            u64::from_le_bytes(record[16..HEADER].try_into().map_err(|_| Error::Corrupt)?);
        if expires
            .checked_sub(issued)
            .is_none_or(|ttl| !(1..=300).contains(&ttl))
        {
            return Err(Error::Corrupt);
        }
        if now.is_some_and(|at| at >= issued && at < expires) {
            // Durable intent alone is not proof that the mutation occurred.
            self.state = State::Armed;
            return Ok(false);
        }
        let prior = &record[HEADER..length];
        self.backend.restore_if_owned(prior)?;
        self.backend.verify_restored(prior)?;
        self.store.clear().map_err(|_| Error::Store)?;
        self.state = State::Idle;
        Ok(true)
    }
    pub fn arm_apply(&mut self, now: u64, ttl: u64) -> Result<(), Error> {
        if self.state != State::Idle {
            return Err(Error::Busy);
        }
        if !(1..=300).contains(&ttl) {
            return Err(Error::Invalid);
        }
        let expires = now.checked_add(ttl).ok_or(Error::Invalid)?;
        // Refuse an existing durable lease even if another actor changed the store.
        let mut record = [0; MAX_RECORD];
        match self.store.load_into(&mut record) {
            Ok(None) => {}
            Ok(Some(_)) => {
                self.state = State::RecoveryRequired;
                return Err(Error::Busy);
            }
            Err(_) => {
                self.state = State::RecoveryRequired;
                return Err(Error::Store);
            }
        }
        let length = self.backend.capture_into(&mut record[HEADER..])?;
        if length == 0 || length > MAX_RECORD - HEADER {
            return Err(Error::Invalid);
        }
        record[..8].copy_from_slice(MAGIC);
        record[8..16].copy_from_slice(&now.to_le_bytes());
        record[16..HEADER].copy_from_slice(&expires.to_le_bytes());
        self.state = State::RecoveryRequired;
        self.store
            .persist(&record[..HEADER + length])
            .map_err(|_| Error::Store)?;
        self.state = State::Armed;
        if let Err(error) = self
            .backend
            .apply_if_unchanged(&record[HEADER..HEADER + length])
        {
            self.state = State::RecoveryRequired;
            return Err(error);
        }
        if let Err(error) = self.backend.verify_applied() {
            self.state = State::RecoveryRequired;
            return Err(error);
        }
        self.state = State::Applied;
        Ok(())
    }
}
