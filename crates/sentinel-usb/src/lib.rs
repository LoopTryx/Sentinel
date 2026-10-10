//! Broker-internal USB decisions and a Windows policy backend. No application
//! activates this crate; configuration is not evidence of device containment.
//!
//! Only a trusted platform adapter may confirm a measured hold or action result.
//! Correlation IDs and the `authorized` input are NOT an IPC authorization scheme.
//! The adapter must derive authorization, clock, fresh random run nonce and scan
//! result from trusted state; never accept these assertions from a browser.
pub mod policy;
pub mod recovery;

const MAX_CONNECTIONS: usize = 64;
const REPORT_SECONDS: u64 = 120;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Connection {
    run: [u8; 16],
    serial: u64,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Job {
    connection: Connection,
    serial: u64,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Interface {
    Storage,
    Hid,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Interfaces {
    pub storage: bool,
    pub hid: bool,
    pub other: bool,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum State {
    Absent,
    Observed,
    Held,
    Released,
    Gap,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScanResult {
    CompleteNoFindings,
    Findings,
    Incomplete,
    Failed,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    Invalid,
    Capacity,
    UnknownConnection,
    NotHeld,
    Busy,
    WrongJob,
    InspectionRequired,
    Unauthorized,
    ClockRollback,
    StaleIntent,
    PlatformFailure,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Snapshot {
    pub storage: State,
    pub hid: State,
    pub unsupported_interfaces: bool,
}
/// Single-use proposal, not proof that Windows released or authorized anything.
pub struct ReleaseIntent {
    connection: Connection,
    interface: Interface,
    serial: u64,
}
impl ReleaseIntent {
    /// Target correlation only; the broker must authenticate the action separately.
    pub fn target(&self) -> (Connection, Interface) {
        (self.connection, self.interface)
    }
}
struct Session {
    connection: Connection,
    snapshot: Snapshot,
    job: Option<Job>,
    report: Option<(ScanResult, u64)>,
    storage_intent: Option<u64>,
    hid_intent: Option<u64>,
}
impl Session {
    fn state(&mut self, interface: Interface) -> &mut State {
        match interface {
            Interface::Storage => &mut self.snapshot.storage,
            Interface::Hid => &mut self.snapshot.hid,
        }
    }
    fn intent(&mut self, interface: Interface) -> &mut Option<u64> {
        match interface {
            Interface::Storage => &mut self.storage_intent,
            Interface::Hid => &mut self.hid_intent,
        }
    }
    fn eligible(&self, now: u64) -> bool {
        self.report.is_some_and(|(result, at)| {
            result == ScanResult::CompleteNoFindings
                && now.checked_sub(at).is_some_and(|age| age < REPORT_SECONDS)
        })
    }
}
pub struct Gate {
    run: [u8; 16],
    serial: u64,
    last_now: u64,
    sessions: Vec<Session>,
}
impl Gate {
    pub fn new(run: [u8; 16], now: u64) -> Result<Self, Error> {
        if run == [0; 16] {
            return Err(Error::Invalid);
        }
        Ok(Self {
            run,
            serial: 0,
            last_now: now,
            sessions: Vec::new(),
        })
    }
    fn tick(&mut self, now: u64) -> Result<(), Error> {
        if now < self.last_now {
            self.policy_lost();
            return Err(Error::ClockRollback);
        }
        self.last_now = now;
        Ok(())
    }
    fn serial(&mut self) -> Result<u64, Error> {
        self.serial = self.serial.checked_add(1).ok_or(Error::Capacity)?;
        Ok(self.serial)
    }
    fn session(&mut self, connection: Connection) -> Result<&mut Session, Error> {
        self.sessions
            .iter_mut()
            .find(|s| s.connection == connection)
            .ok_or(Error::UnknownConnection)
    }
    pub fn connect(&mut self, interfaces: Interfaces, now: u64) -> Result<Connection, Error> {
        self.tick(now)?;
        if !interfaces.storage && !interfaces.hid && !interfaces.other {
            return Err(Error::Invalid);
        }
        if self.sessions.len() >= MAX_CONNECTIONS {
            return Err(Error::Capacity);
        }
        let connection = Connection {
            run: self.run,
            serial: self.serial()?,
        };
        self.sessions.push(Session {
            connection,
            snapshot: Snapshot {
                storage: if interfaces.storage {
                    State::Observed
                } else {
                    State::Absent
                },
                hid: if interfaces.hid {
                    State::Observed
                } else {
                    State::Absent
                },
                unsupported_interfaces: interfaces.other,
            },
            job: None,
            report: None,
            storage_intent: None,
            hid_intent: None,
        });
        Ok(connection)
    }
    pub fn disconnect(&mut self, connection: Connection) -> Result<(), Error> {
        let index = self
            .sessions
            .iter()
            .position(|s| s.connection == connection)
            .ok_or(Error::UnknownConnection)?;
        self.sessions.swap_remove(index);
        Ok(())
    }
    pub fn snapshot(&self, connection: Connection) -> Result<Snapshot, Error> {
        self.sessions
            .iter()
            .find(|s| s.connection == connection)
            .map(|s| s.snapshot)
            .ok_or(Error::UnknownConnection)
    }
    /// Call only after OS hold verification for THIS connection/interface.
    /// A late device disable does not establish a pre-input hold.
    pub fn confirm_hold(
        &mut self,
        connection: Connection,
        interface: Interface,
        now: u64,
    ) -> Result<(), Error> {
        self.tick(now)?;
        let session = self.session(connection)?;
        if *session.state(interface) == State::Absent {
            return Err(Error::Invalid);
        }
        *session.state(interface) = State::Held;
        *session.intent(interface) = None;
        if interface == Interface::Storage {
            session.job = None;
            session.report = None;
        }
        Ok(())
    }
    pub fn begin_inspection(&mut self, connection: Connection, now: u64) -> Result<Job, Error> {
        self.tick(now)?;
        let session = self.session(connection)?;
        if session.snapshot.storage != State::Held {
            return Err(Error::NotHeld);
        }
        if session.job.is_some() || session.storage_intent.is_some() {
            return Err(Error::Busy);
        }
        let job = Job {
            connection,
            serial: self.serial()?,
        };
        let session = self.session(connection)?;
        session.report = None;
        session.job = Some(job);
        Ok(job)
    }
    /// Invalidate decisions immediately; scanner controller must separately cancel
    /// and retain worker admission until the real worker has exited/joined.
    pub fn invalidate_inspection(&mut self, connection: Connection) -> Result<(), Error> {
        let session = self.session(connection)?;
        session.job = None;
        session.report = None;
        // An action already dispatched cannot safely be described as still held.
        if session.storage_intent.take().is_some() {
            session.snapshot.storage = State::Gap;
        }
        Ok(())
    }
    pub fn finish_inspection(
        &mut self,
        connection: Connection,
        job: Job,
        result: ScanResult,
        now: u64,
    ) -> Result<(), Error> {
        self.tick(now)?;
        let session = self.session(connection)?;
        if job.connection != connection || session.job != Some(job) {
            return Err(Error::WrongJob);
        }
        if session.snapshot.storage != State::Held {
            return Err(Error::NotHeld);
        }
        session.job = None;
        session.report = Some((result, now));
        Ok(())
    }
    /// Authorization is derived by the trusted broker, separately for each scope.
    /// CompleteNoFindings is allowed only for the reviewed scanner's whole scope,
    /// not worker exit, connection success, demo output or an empty database.
    pub fn request_release(
        &mut self,
        connection: Connection,
        interface: Interface,
        authorized: bool,
        now: u64,
    ) -> Result<ReleaseIntent, Error> {
        self.tick(now)?;
        if !authorized {
            return Err(Error::Unauthorized);
        }
        let session = self.session(connection)?;
        if *session.state(interface) != State::Held {
            return Err(Error::NotHeld);
        }
        if session.intent(interface).is_some() {
            return Err(Error::Busy);
        }
        if interface == Interface::Storage && !session.eligible(now) {
            return Err(Error::InspectionRequired);
        }
        let serial = self.serial()?;
        *self.session(connection)?.intent(interface) = Some(serial);
        Ok(ReleaseIntent {
            connection,
            interface,
            serial,
        })
    }
    /// Trusted, serialized broker calls immediately before the platform action.
    /// Authentication and connection/policy identity must ALSO be rechecked by it.
    pub fn revalidate_release(&mut self, intent: &ReleaseIntent, now: u64) -> Result<(), Error> {
        self.tick(now)?;
        let session = self.session(intent.connection)?;
        if *session.intent(intent.interface) != Some(intent.serial)
            || *session.state(intent.interface) != State::Held
        {
            return Err(Error::StaleIntent);
        }
        if intent.interface == Interface::Storage && !session.eligible(now) {
            // No action has run, so keep the verified hold but consume the proposal.
            *session.intent(intent.interface) = None;
            session.report = None;
            return Err(Error::InspectionRequired);
        }
        Ok(())
    }
    /// Platform adapter must revalidate immediately before applying the proposal.
    /// An expired/failed callback becomes a visible gap and requires verified revoke.
    pub fn complete_release(
        &mut self,
        intent: ReleaseIntent,
        succeeded: bool,
        now: u64,
    ) -> Result<(), Error> {
        self.tick(now)?;
        let session = self.session(intent.connection)?;
        if *session.intent(intent.interface) != Some(intent.serial) {
            // A callback means an OS action may already have happened. Even a
            // superseded proposal cannot leave a newer hold falsely asserted.
            *session.state(intent.interface) = State::Gap;
            *session.intent(intent.interface) = None;
            if intent.interface == Interface::Storage {
                session.job = None;
                session.report = None;
            }
            return Err(Error::StaleIntent);
        }
        *session.intent(intent.interface) = None;
        if !succeeded || (intent.interface == Interface::Storage && !session.eligible(now)) {
            *session.state(intent.interface) = State::Gap;
            session.report = None;
            return Err(if succeeded {
                Error::InspectionRequired
            } else {
                Error::PlatformFailure
            });
        }
        *session.state(intent.interface) = State::Released;
        Ok(())
    }
    /// Service loss, unknown policy drift or recovery disables all protection claims.
    pub fn policy_lost(&mut self) {
        for session in &mut self.sessions {
            for interface in [Interface::Storage, Interface::Hid] {
                if *session.state(interface) != State::Absent {
                    *session.state(interface) = State::Gap;
                }
                *session.intent(interface) = None;
            }
            session.job = None;
            session.report = None;
        }
    }
}
