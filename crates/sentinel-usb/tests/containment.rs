use sentinel_usb::containment::{Containment, Error, Isolation, Outcome};
use sentinel_usb::{Gate, Interface, Interfaces, State};
use std::{cell::Cell, rc::Rc};
#[derive(Default)]
struct Flags {
    attach_fail: Cell<bool>,
    verify_fail: Cell<bool>,
    cleanup_fail: Cell<bool>,
    stops: Cell<usize>,
}
struct Provider(Rc<Flags>);
impl Isolation for Provider {
    fn attach_exclusive(&mut self, _: sentinel_usb::Connection) -> Result<(), Error> {
        if self.0.attach_fail.get() {
            Err(Error::Platform)
        } else {
            Ok(())
        }
    }
    fn verify_exclusive(&mut self, _: sentinel_usb::Connection) -> Result<(), Error> {
        if self.0.verify_fail.get() {
            Err(Error::Platform)
        } else {
            Ok(())
        }
    }
    fn stop_and_verify(&mut self, _: sentinel_usb::Connection) -> Result<(), Error> {
        self.0.stops.set(self.0.stops.get() + 1);
        if self.0.cleanup_fail.get() {
            Err(Error::Platform)
        } else {
            Ok(())
        }
    }
}
fn setup() -> (
    Gate,
    sentinel_usb::Connection,
    Containment<Provider>,
    Rc<Flags>,
) {
    let mut gate = Gate::new([1; 16], 100).unwrap();
    let connection = gate
        .connect(
            Interfaces {
                storage: true,
                hid: true,
                other: false,
            },
            100,
        )
        .unwrap();
    let flags = Rc::new(Flags::default());
    let controller = Containment::new(Provider(flags.clone()));
    gate.confirm_hold(connection, Interface::Hid, 100).unwrap();
    (gate, connection, controller, flags)
}
#[test]
fn observation_is_not_hold_and_quiet_is_never_approval() {
    let (mut gate, c, mut ctl, _) = setup();
    gate.policy_lost();
    assert!(matches!(ctl.begin(&gate, c, 100), Err(Error::NotHeld)));
    gate.confirm_hold(c, Interface::Hid, 101).unwrap();
    let id = ctl.begin(&gate, c, 101).unwrap();
    assert_eq!(ctl.finish(&gate, id, 102), Ok(Outcome::QuietObservation));
    assert_eq!(gate.snapshot(c).unwrap().hid, State::Held);
    assert_eq!(gate.snapshot(c).unwrap().storage, State::Gap);
}
#[test]
fn input_activity_is_redacted_and_does_not_release() {
    let (gate, c, mut ctl, _) = setup();
    let id = ctl.begin(&gate, c, 100).unwrap();
    assert_eq!(
        ctl.observe(&gate, id, 101, 0, 1),
        Ok(Outcome::InputObserved)
    );
    assert_eq!(ctl.finish(&gate, id, 102), Ok(Outcome::InputObserved));
    assert_eq!(gate.snapshot(c).unwrap().hid, State::Held);
}
#[test]
fn stale_session_cannot_affect_new_observation() {
    let (gate, c, mut ctl, flags) = setup();
    let old = ctl.begin(&gate, c, 100).unwrap();
    ctl.cancel(old).unwrap();
    let new = ctl.begin(&gate, c, 101).unwrap();
    assert_eq!(ctl.observe(&gate, old, 102, 1, 1), Err(Error::WrongSession));
    assert_eq!(ctl.cancel(old), Err(Error::WrongSession));
    assert_eq!(flags.stops.get(), 1);
    ctl.cancel(new).unwrap();
}
#[test]
fn disconnected_or_policy_lost_session_stops() {
    for disconnected in [false, true] {
        let (mut gate, c, mut ctl, flags) = setup();
        let id = ctl.begin(&gate, c, 100).unwrap();
        if disconnected {
            gate.disconnect(c).unwrap();
        } else {
            gate.policy_lost();
        }
        assert_eq!(
            ctl.observe(&gate, id, 101, 0, 0),
            Ok(Outcome::ContainmentLost)
        );
        assert_eq!(flags.stops.get(), 1);
    }
}
#[test]
fn attachment_failure_is_cleaned_and_cleanup_failure_holds_admission() {
    let (gate, c, mut ctl, flags) = setup();
    flags.attach_fail.set(true);
    flags.cleanup_fail.set(true);
    assert!(matches!(
        ctl.begin(&gate, c, 100),
        Err(Error::CleanupRequired)
    ));
    assert!(matches!(ctl.begin(&gate, c, 101), Err(Error::Busy)));
    flags.cleanup_fail.set(false);
    assert_eq!(ctl.retry_cleanup(), Ok(Outcome::ContainmentLost));
    flags.attach_fail.set(false);
    let id = ctl.begin(&gate, c, 102).unwrap();
    ctl.cancel(id).unwrap();
}
#[test]
fn cumulative_limits_and_overflow_stop_before_retaining_activity() {
    for (reports, bytes) in [(4097, 0), (0, 65537), (u64::MAX, u64::MAX)] {
        let (gate, c, mut ctl, _) = setup();
        let id = ctl.begin(&gate, c, 100).unwrap();
        assert_eq!(
            ctl.observe(&gate, id, 101, reports, bytes),
            Ok(Outcome::BudgetExceeded)
        );
    }
    let (gate, c, mut ctl, _) = setup();
    let id = ctl.begin(&gate, c, 100).unwrap();
    assert_eq!(
        ctl.observe(&gate, id, 101, 4096, 65536),
        Ok(Outcome::InputObserved)
    );
    assert_eq!(
        ctl.observe(&gate, id, 102, 1, 0),
        Ok(Outcome::BudgetExceeded)
    );
}
#[test]
fn timeout_rollback_and_lost_provider_never_return_quiet() {
    let (gate, c, mut ctl, flags) = setup();
    let id = ctl.begin(&gate, c, 100).unwrap();
    assert_eq!(ctl.finish(&gate, id, 220), Ok(Outcome::TimedOut));
    let id = ctl.begin(&gate, c, 221).unwrap();
    assert_eq!(ctl.observe(&gate, id, 220, 0, 0), Err(Error::ClockRollback));
    let id = ctl.begin(&gate, c, 222).unwrap();
    flags.verify_fail.set(true);
    assert_eq!(ctl.finish(&gate, id, 223), Ok(Outcome::ContainmentLost));
}
#[test]
fn failed_cleanup_retains_terminal_reason_and_prevents_reuse() {
    let (gate, c, mut ctl, flags) = setup();
    let id = ctl.begin(&gate, c, 100).unwrap();
    flags.cleanup_fail.set(true);
    assert_eq!(
        ctl.observe(&gate, id, 220, 0, 0),
        Err(Error::CleanupRequired)
    );
    assert_eq!(
        ctl.observe(&gate, id, 221, 0, 0),
        Err(Error::CleanupRequired)
    );
    assert_eq!(ctl.cancel(id), Err(Error::CleanupRequired));
    assert!(matches!(ctl.begin(&gate, c, 222), Err(Error::Busy)));
    flags.cleanup_fail.set(false);
    assert_eq!(ctl.retry_cleanup(), Ok(Outcome::TimedOut));
}
