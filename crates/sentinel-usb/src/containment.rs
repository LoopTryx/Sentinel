//! Broker-only isolated HID observation lifecycle. This is not a USB hypervisor.
//! There is deliberately no "safe" result and no host-input release operation.
//! The native provider must enforce exclusive guest routing before returning Ok;
//! descriptor inspection, a process sandbox or registry equality cannot do that.
use crate::{Connection, Gate, State};

const MAX_SECONDS: u64 = 120;
const MAX_REPORTS: u64 = 4096;
const MAX_BYTES: u64 = 65536;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    Busy,
    NotHeld,
    WrongSession,
    Platform,
    CleanupRequired,
    ClockRollback,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Observing,
    InputObserved,
    QuietObservation,
    BudgetExceeded,
    TimedOut,
    Cancelled,
    ContainmentLost,
}
/// Opaque connection-and-generation binding, not authorization or an IPC token.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Observation {
    connection: Connection,
    generation: u64,
}
/// Implementations must use trusted native state, not browser assertions.
/// Operations must have native deadlines. Even failed attach can allocate
/// resources; stop_and_verify must reap them before another session is admitted.
/// A successful stop leaves host HID denied, never reconnects it to the host.
pub trait Isolation {
    fn attach_exclusive(&mut self, connection: Connection) -> Result<(), Error>;
    fn verify_exclusive(&mut self, connection: Connection) -> Result<(), Error>;
    fn stop_and_verify(&mut self, connection: Connection) -> Result<(), Error>;
}
struct Active {
    id: Observation,
    started: u64,
    last_now: u64,
    reports: u64,
    bytes: u64,
    outcome: Outcome,
    stopping: bool,
}
pub struct Containment<P: Isolation> {
    provider: P,
    generation: u64,
    active: Option<Active>,
}
impl<P: Isolation> Containment<P> {
    pub fn new(provider: P) -> Self {
        Self {
            provider,
            generation: 0,
            active: None,
        }
    }
    pub fn begin(
        &mut self,
        gate: &Gate,
        connection: Connection,
        now: u64,
    ) -> Result<Observation, Error> {
        if self.active.is_some() {
            return Err(Error::Busy);
        }
        if gate.snapshot(connection).map_err(|_| Error::NotHeld)?.hid != State::Held {
            return Err(Error::NotHeld);
        }
        self.generation = self.generation.checked_add(1).ok_or(Error::Busy)?;
        let id = Observation {
            connection,
            generation: self.generation,
        };
        self.active = Some(Active {
            id,
            started: now,
            last_now: now,
            reports: 0,
            bytes: 0,
            outcome: Outcome::Observing,
            stopping: false,
        });
        if self.provider.attach_exclusive(connection).is_err()
            || self.provider.verify_exclusive(connection).is_err()
        {
            self.stop(Outcome::ContainmentLost)?;
            return Err(Error::Platform);
        }
        Ok(id)
    }
    /// Counts only. No keystrokes, command text or USB payload bytes are retained.
    /// Caller derives report counts from its bounded trusted transport.
    pub fn observe(
        &mut self,
        gate: &Gate,
        id: Observation,
        now: u64,
        reports: u64,
        bytes: u64,
    ) -> Result<Outcome, Error> {
        let active = self.active.as_mut().ok_or(Error::WrongSession)?;
        if active.id != id {
            return Err(Error::WrongSession);
        }
        if active.stopping {
            return Err(Error::CleanupRequired);
        }
        if now < active.last_now {
            self.stop(Outcome::ContainmentLost)?;
            return Err(Error::ClockRollback);
        }
        active.last_now = now;
        if gate.snapshot(id.connection).is_err()
            || gate
                .snapshot(id.connection)
                .is_ok_and(|s| s.hid != State::Held)
            || self.provider.verify_exclusive(id.connection).is_err()
        {
            return self.stop(Outcome::ContainmentLost);
        }
        if now - active.started >= MAX_SECONDS {
            return self.stop(Outcome::TimedOut);
        }
        if reports > MAX_REPORTS - active.reports || bytes > MAX_BYTES - active.bytes {
            return self.stop(Outcome::BudgetExceeded);
        }
        active.reports += reports;
        active.bytes += bytes;
        // Byte-bearing activity is evidence too, even if a provider reports zero
        // complete reports. Never treat malformed/partial input as silence.
        if reports != 0 || bytes != 0 {
            active.outcome = Outcome::InputObserved;
        }
        Ok(active.outcome)
    }
    /// "Quiet" means only no activity observed during this session. HID stays held.
    pub fn finish(&mut self, gate: &Gate, id: Observation, now: u64) -> Result<Outcome, Error> {
        let outcome = self.observe(gate, id, now, 0, 0)?;
        if self.active.is_none() {
            return Ok(outcome);
        }
        self.stop(if outcome == Outcome::Observing {
            Outcome::QuietObservation
        } else {
            outcome
        })
    }
    pub fn cancel(&mut self, id: Observation) -> Result<Outcome, Error> {
        if !self.active.as_ref().is_some_and(|a| a.id == id) {
            return Err(Error::WrongSession);
        }
        self.stop(Outcome::Cancelled)
    }
    /// Retry retains the terminal reason and admission slot until native cleanup
    /// is verified. Do not drop this controller to pretend cleanup succeeded.
    pub fn retry_cleanup(&mut self) -> Result<Outcome, Error> {
        let active = self.active.as_ref().ok_or(Error::WrongSession)?;
        if !active.stopping {
            return Err(Error::Busy);
        }
        self.stop(active.outcome)
    }
    fn stop(&mut self, outcome: Outcome) -> Result<Outcome, Error> {
        let active = self.active.as_mut().ok_or(Error::WrongSession)?;
        if !active.stopping {
            active.outcome = outcome;
        }
        active.stopping = true;
        if self.provider.stop_and_verify(active.id.connection).is_err() {
            return Err(Error::CleanupRequired);
        }
        let outcome = active.outcome;
        self.active = None;
        Ok(outcome)
    }
}
