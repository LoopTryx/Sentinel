use sentinel_usb::recovery::{Backend, Error, Recovery, State, Store};
use std::{cell::RefCell, rc::Rc};

#[derive(Default)]
struct Model {
    record: Option<Vec<u8>>,
    events: Vec<&'static str>,
    fail_persist: bool,
    fail_verify: bool,
    conflict: bool,
    fail_clear: bool,
    policy: u8,
}
#[derive(Clone)]
struct Fake(Rc<RefCell<Model>>);
impl Store for Fake {
    fn persist(&mut self, record: &[u8]) -> Result<(), Error> {
        let mut m = self.0.borrow_mut();
        m.events.push("persist");
        if m.fail_persist {
            return Err(Error::Store);
        }
        m.record = Some(record.to_vec());
        Ok(())
    }
    fn load_into(&mut self, record: &mut [u8]) -> Result<Option<usize>, Error> {
        let m = self.0.borrow();
        let Some(bytes) = &m.record else {
            return Ok(None);
        };
        if bytes.len() > record.len() {
            return Ok(Some(bytes.len()));
        }
        record[..bytes.len()].copy_from_slice(bytes);
        Ok(Some(bytes.len()))
    }
    fn clear(&mut self) -> Result<(), Error> {
        let mut m = self.0.borrow_mut();
        m.events.push("clear");
        if m.fail_clear {
            return Err(Error::Store);
        }
        m.record = None;
        Ok(())
    }
}
impl Backend for Fake {
    fn capture_into(&mut self, prior: &mut [u8]) -> Result<usize, Error> {
        let mut m = self.0.borrow_mut();
        m.events.push("capture");
        prior[0] = m.policy;
        Ok(1)
    }
    fn apply_if_unchanged(&mut self, prior: &[u8]) -> Result<(), Error> {
        let mut m = self.0.borrow_mut();
        m.events.push("apply");
        if m.policy != prior[0] {
            return Err(Error::Conflict);
        }
        m.policy = 1;
        Ok(())
    }
    fn verify_applied(&mut self) -> Result<(), Error> {
        let mut m = self.0.borrow_mut();
        m.events.push("verify");
        if m.fail_verify {
            Err(Error::Platform)
        } else {
            Ok(())
        }
    }
    fn restore_if_owned(&mut self, prior: &[u8]) -> Result<(), Error> {
        let mut m = self.0.borrow_mut();
        m.events.push("restore");
        if m.conflict {
            return Err(Error::Conflict);
        }
        m.policy = prior[0];
        Ok(())
    }
    fn verify_restored(&mut self, prior: &[u8]) -> Result<(), Error> {
        let mut m = self.0.borrow_mut();
        m.events.push("verify_restored");
        if m.policy != prior[0] {
            Err(Error::Platform)
        } else {
            Ok(())
        }
    }
}
fn fixture() -> (Recovery<Fake, Fake>, Rc<RefCell<Model>>) {
    let model = Rc::new(RefCell::new(Model::default()));
    let fake = Fake(model.clone());
    (Recovery::new(fake.clone(), fake), model)
}
#[test]
fn recovery_is_required_before_any_new_policy_and_persist_precedes_apply() {
    let (mut r, m) = fixture();
    assert_eq!(r.arm_apply(100, 30), Err(Error::Busy));
    assert_eq!(r.recover_pending(), Ok(false));
    r.arm_apply(100, 30).unwrap();
    assert_eq!(r.state(), State::Applied);
    assert_eq!(
        m.borrow().events,
        vec!["capture", "persist", "apply", "verify"]
    );
    r.recover_due(130).unwrap();
    assert_eq!(m.borrow().policy, 0);
    assert!(m.borrow().record.is_none());
    assert_eq!(
        &m.borrow().events[4..],
        &["restore", "verify_restored", "clear"]
    );
}
#[test]
fn store_failure_prevents_mutation_and_never_claims_applied() {
    let (mut r, m) = fixture();
    r.recover_pending().unwrap();
    m.borrow_mut().fail_persist = true;
    assert_eq!(r.arm_apply(100, 30), Err(Error::Store));
    assert_eq!(r.state(), State::RecoveryRequired);
    assert!(!m.borrow().events.contains(&"apply"));
    assert_eq!(m.borrow().policy, 0);
}
#[test]
fn failed_verification_preserves_recovery_intent() {
    let (mut r, m) = fixture();
    r.recover_pending().unwrap();
    m.borrow_mut().fail_verify = true;
    assert_eq!(r.arm_apply(100, 30), Err(Error::Platform));
    assert!(m.borrow().record.is_some());
    assert_eq!(r.state(), State::RecoveryRequired);
    r.recover_pending().unwrap();
    assert_eq!(m.borrow().policy, 0);
}
#[test]
fn unrelated_drift_is_not_overwritten_or_cleared() {
    let (mut r, m) = fixture();
    r.recover_pending().unwrap();
    r.arm_apply(100, 30).unwrap();
    m.borrow_mut().conflict = true;
    assert_eq!(r.recover_pending(), Err(Error::Conflict));
    assert!(m.borrow().record.is_some());
    assert_eq!(r.state(), State::RecoveryRequired);
}
#[test]
fn failed_clear_is_retriable_after_successful_restore() {
    let (mut r, m) = fixture();
    r.recover_pending().unwrap();
    r.arm_apply(100, 30).unwrap();
    m.borrow_mut().fail_clear = true;
    assert_eq!(r.recover_pending(), Err(Error::Store));
    assert_eq!(m.borrow().policy, 0);
    assert!(m.borrow().record.is_some());
    m.borrow_mut().fail_clear = false;
    r.recover_pending().unwrap();
    assert_eq!(r.state(), State::Idle);
}
#[test]
fn restart_recovers_immediately_and_clock_rollback_does_not_extend_lease() {
    let (mut r, m) = fixture();
    r.recover_pending().unwrap();
    r.arm_apply(100, 30).unwrap();
    assert_eq!(r.recover_due(110), Ok(false));
    assert_eq!(r.state(), State::Armed);
    assert_eq!(r.recover_due(99), Ok(true));
    assert_eq!(m.borrow().policy, 0);
    r.arm_apply(100, 30).unwrap();
    let fake = Fake(m.clone());
    let mut restarted = Recovery::new(fake.clone(), fake);
    assert_eq!(restarted.recover_pending(), Ok(true));
    assert_eq!(m.borrow().policy, 0);
}
#[test]
fn malformed_oversized_and_excessive_leases_are_refused() {
    let (mut r, m) = fixture();
    m.borrow_mut().record = Some(vec![0; 5000]);
    assert_eq!(r.recover_pending(), Err(Error::Corrupt));
    m.borrow_mut().record = Some(vec![0; 17]);
    assert_eq!(r.recover_pending(), Err(Error::Corrupt));
    m.borrow_mut().record = None;
    r.recover_pending().unwrap();
    assert_eq!(r.arm_apply(100, 0), Err(Error::Invalid));
    assert_eq!(r.arm_apply(100, 301), Err(Error::Invalid));
    assert_eq!(r.arm_apply(u64::MAX, 1), Err(Error::Invalid));
    assert!(!m.borrow().events.contains(&"apply"));
}
