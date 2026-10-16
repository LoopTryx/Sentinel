//! Native authenticated-adapter sink only. No endpoint/transport is registered.
use sentinel_proto::browser_activity::BrowserActivityEvent;
use std::collections::VecDeque;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivityError {
    InvalidEvent,
    WrongSession,
    Replay,
}
fn valid(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
pub struct BrowserActivityInbox {
    session_ref: String,
    last: Option<BrowserActivityEvent>,
    events: VecDeque<BrowserActivityEvent>,
    omitted: u32,
}
impl BrowserActivityInbox {
    pub fn new(session_ref: &str) -> Result<Self, ActivityError> {
        if !valid(session_ref) {
            return Err(ActivityError::InvalidEvent);
        }
        Ok(Self {
            session_ref: session_ref.into(),
            last: None,
            events: VecDeque::new(),
            omitted: 0,
        })
    }
    /// Returns false only for an exact replay of the latest accepted event.
    pub fn accept(&mut self, event: BrowserActivityEvent) -> Result<bool, ActivityError> {
        if event.sequence == 0
            || !valid(&event.session_ref)
            || !valid(&event.navigation_ref)
            || !valid(&event.assessment_ref)
        {
            return Err(ActivityError::InvalidEvent);
        }
        if event.session_ref != self.session_ref {
            return Err(ActivityError::WrongSession);
        }
        if let Some(last) = &self.last {
            if last == &event {
                return Ok(false);
            }
            if event.sequence <= last.sequence {
                return Err(ActivityError::Replay);
            }
        }
        if self.events.len() == 128 {
            self.events.pop_front();
            self.omitted += 1;
        }
        self.last = Some(event.clone());
        self.events.push_back(event);
        Ok(true)
    }
    pub fn events(&self) -> impl Iterator<Item = &BrowserActivityEvent> {
        self.events.iter()
    }
    pub fn omitted(&self) -> u32 {
        self.omitted
    }
}
