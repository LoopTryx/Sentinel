//! Single-operation cooperative cancellation/deadline control.
//! This cannot interrupt a blocked OS read or terminate/reap a worker process.
use sentinel_proto::scan_report::LocalScanControlState;
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU8, Ordering},
    },
    time::{Duration, Instant},
};
const RUNNING: u8 = 0;
const CANCELLED: u8 = 1;
const TIMED_OUT: u8 = 2;
const RETURNED: u8 = 3;

#[derive(Clone, Debug)]
pub struct LocalScanControl(Arc<Inner>);
#[derive(Debug)]
struct Inner {
    deadline: Instant,
    state: AtomicU8,
    returned: AtomicBool,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct InvalidScanDeadline;
impl std::fmt::Display for InvalidScanDeadline {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("invalid local scan deadline")
    }
}
impl std::error::Error for InvalidScanDeadline {}
impl LocalScanControl {
    /// Timeout starts at construction, including any queue delay before scanning.
    pub fn new(timeout: Duration) -> Result<Self, InvalidScanDeadline> {
        if timeout < Duration::from_millis(1) || timeout > Duration::from_secs(300) {
            return Err(InvalidScanDeadline);
        }
        let deadline = Instant::now()
            .checked_add(timeout)
            .ok_or(InvalidScanDeadline)?;
        Ok(Self(Arc::new(Inner {
            deadline,
            state: AtomicU8::new(RUNNING),
            returned: AtomicBool::new(false),
        })))
    }
    /// First observed stop wins; an expired deadline precedes this cancel request.
    pub fn request_cancel(&self) {
        self.observe_deadline_at(Instant::now());
        let _ =
            self.0
                .state
                .compare_exchange(RUNNING, CANCELLED, Ordering::AcqRel, Ordering::Acquire);
    }
    pub fn should_stop(&self) -> bool {
        matches!(
            self.state(),
            LocalScanControlState::Cancelled | LocalScanControlState::TimedOut
        )
    }
    /// Stop requests may be visible before the scanner returns.
    pub fn has_returned(&self) -> bool {
        self.0.returned.load(Ordering::Acquire)
    }
    pub fn state(&self) -> LocalScanControlState {
        self.observe_deadline_at(Instant::now());
        self.current_state()
    }
    /// Worker calls only after the scanner returns. Freezes the terminal state.
    /// Retain actual result/partial counters separately; never reuse this token.
    pub fn finish(&self) -> LocalScanControlState {
        self.observe_deadline_at(Instant::now());
        let _ =
            self.0
                .state
                .compare_exchange(RUNNING, RETURNED, Ordering::AcqRel, Ordering::Acquire);
        self.0.returned.store(true, Ordering::Release);
        self.current_state()
    }
    fn observe_deadline_at(&self, now: Instant) {
        if now >= self.0.deadline {
            let _ = self.0.state.compare_exchange(
                RUNNING,
                TIMED_OUT,
                Ordering::AcqRel,
                Ordering::Acquire,
            );
        }
    }
    fn current_state(&self) -> LocalScanControlState {
        match self.0.state.load(Ordering::Acquire) {
            CANCELLED => LocalScanControlState::Cancelled,
            TIMED_OUT => LocalScanControlState::TimedOut,
            RETURNED => LocalScanControlState::Returned,
            _ => LocalScanControlState::Running,
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deterministic_first_stop_is_not_relabelled_after_expiry() {
        let control = LocalScanControl::new(Duration::from_secs(300)).unwrap();
        control.request_cancel();
        control.observe_deadline_at(control.0.deadline);
        assert_eq!(control.finish(), LocalScanControlState::Cancelled);
        let expired = LocalScanControl::new(Duration::from_secs(300)).unwrap();
        expired.observe_deadline_at(expired.0.deadline);
        expired.request_cancel();
        assert_eq!(expired.finish(), LocalScanControlState::TimedOut);
    }
    #[test]
    fn deterministic_returned_state_is_frozen_past_deadline() {
        let control = LocalScanControl::new(Duration::from_secs(300)).unwrap();
        assert_eq!(control.finish(), LocalScanControlState::Returned);
        control.observe_deadline_at(control.0.deadline);
        control.request_cancel();
        assert_eq!(control.state(), LocalScanControlState::Returned);
    }
}
