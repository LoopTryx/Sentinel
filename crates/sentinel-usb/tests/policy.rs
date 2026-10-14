use sentinel_usb::{
    policy::{Entry, InputPolicy, PolicyBackend, Registry},
    recovery::{Backend, Error, Recovery, State, Store},
};
use std::{cell::RefCell, rc::Rc};

fn approvals(count: usize, length: usize) -> Vec<String> {
    (0..count)
        .map(|i| {
            let prefix = format!("HID\\DEV{i:04}\\");
            format!("{prefix}{}", "A".repeat(length - prefix.len()))
        })
        .collect()
}

#[test]
fn full_baseline_capacity_remains_bounded_by_count_and_durable_record() {
    let ids = approvals(32, 40);
    let refs: Vec<_> = ids.iter().map(String::as_str).collect();
    assert!(InputPolicy::new(&refs).is_ok());
    let too_many = approvals(33, 40);
    assert!(InputPolicy::new(&too_many.iter().map(String::as_str).collect::<Vec<_>>()).is_err());
    let mut exact = approvals(20, 200);
    exact.push(approvals(21, 42).pop().unwrap());
    let refs: Vec<_> = exact.iter().map(String::as_str).collect();
    let fixture = Fixture::default();
    let mut backend = PolicyBackend::new(fixture, InputPolicy::new(&refs).unwrap());
    let mut encoded = [0; 4072];
    assert_eq!(backend.capture_into(&mut encoded).unwrap(), 4072);
    exact[20].push('B');
    assert!(InputPolicy::new(&exact.iter().map(String::as_str).collect::<Vec<_>>()).is_err());
}

#[test]
fn every_full_capacity_partial_write_recovers_from_the_recorded_profile() {
    for fail_after in [false, true] {
        for fail_at in 0..39 {
            let fixture = Fixture::default();
            fixture.0.borrow_mut().fail_at = Some(fail_at);
            fixture.0.borrow_mut().fail_after = fail_after;
            let ids = approvals(32, 40);
            let refs: Vec<_> = ids.iter().map(String::as_str).collect();
            let mut engine = Recovery::new(
                fixture.clone(),
                PolicyBackend::new(fixture.clone(), InputPolicy::new(&refs).unwrap()),
            );
            engine.recover_pending().unwrap();
            assert_eq!(engine.arm_apply(100, 30), Err(Error::Platform));
            drop(engine);
            let mut restarted = recovery(&fixture);
            assert!(restarted.recover_pending().unwrap());
            assert!(fixture.0.borrow().entries.is_empty());
            assert!(fixture.0.borrow().journal.is_none());
        }
    }
}

#[test]
fn full_capacity_roundtrip_restores_and_retains_conflicting_state() {
    let fixture = Fixture::default();
    let ids = approvals(32, 40);
    let refs: Vec<_> = ids.iter().map(String::as_str).collect();
    let mut engine = Recovery::new(
        fixture.clone(),
        PolicyBackend::new(fixture.clone(), InputPolicy::new(&refs).unwrap()),
    );
    engine.recover_pending().unwrap();
    engine.arm_apply(100, 30).unwrap();
    assert_eq!(fixture.0.borrow().entries.len(), 39);
    fixture.0.borrow_mut().entries.push(foreign());
    assert!(engine.recover_pending().is_err());
    assert!(fixture.0.borrow().journal.is_some());
    fixture.0.borrow_mut().entries.pop();
    assert!(engine.recover_pending().unwrap());
    assert!(fixture.0.borrow().entries.is_empty());
}

#[derive(Default)]
struct Memory {
    entries: Vec<Entry>,
    writes: usize,
    fail_at: Option<usize>,
    fail_after: bool,
    fail_flush: bool,
    removals: Vec<String>,
    journal: Option<Vec<u8>>,
}
#[derive(Clone, Default)]
struct Fixture(Rc<RefCell<Memory>>);
impl Registry for Fixture {
    fn snapshot(&mut self) -> Result<Vec<Entry>, Error> {
        Ok(self.0.borrow().entries.clone())
    }
    fn set(&mut self, entry: &Entry) -> Result<(), Error> {
        let mut state = self.0.borrow_mut();
        assert!(
            state.journal.is_some(),
            "journal must exist before every native mutation"
        );
        let failed = state.fail_at == Some(state.writes);
        if failed && !state.fail_after {
            return Err(Error::Platform);
        }
        state.entries.push(entry.clone());
        state.writes += 1;
        if failed { Err(Error::Platform) } else { Ok(()) }
    }
    fn remove(&mut self, entry: &Entry) -> Result<(), Error> {
        let mut state = self.0.borrow_mut();
        let index = state
            .entries
            .iter()
            .position(|e| e == entry)
            .ok_or(Error::Conflict)?;
        state.entries.remove(index);
        state.removals.push(entry.name.clone());
        Ok(())
    }
    fn flush(&mut self) -> Result<(), Error> {
        if self.0.borrow().fail_flush {
            Err(Error::Platform)
        } else {
            Ok(())
        }
    }
}
impl Store for Fixture {
    fn persist(&mut self, record: &[u8]) -> Result<(), Error> {
        self.0.borrow_mut().journal = Some(record.to_vec());
        Ok(())
    }
    fn load_into(&mut self, output: &mut [u8]) -> Result<Option<usize>, Error> {
        let state = self.0.borrow();
        let Some(record) = &state.journal else {
            return Ok(None);
        };
        output[..record.len()].copy_from_slice(record);
        Ok(Some(record.len()))
    }
    fn clear(&mut self) -> Result<(), Error> {
        self.0.borrow_mut().journal = None;
        Ok(())
    }
}
fn policy() -> InputPolicy {
    InputPolicy::new(&["HID\\SYNTHETIC\\KEYBOARD"]).unwrap()
}
fn recovery(fixture: &Fixture) -> Recovery<Fixture, PolicyBackend<Fixture>> {
    Recovery::new(
        fixture.clone(),
        PolicyBackend::new(fixture.clone(), policy()),
    )
}
fn foreign() -> Entry {
    Entry {
        key: String::new(),
        name: "AllowAdminInstall".into(),
        kind: 4,
        data: 1u32.to_le_bytes().to_vec(),
    }
}

#[test]
fn refuses_wildcards_hardware_ids_oversized_and_duplicate_instance_approvals() {
    for id in [
        "",
        "USB\\VID_1234",
        "HID\\*\\KEY",
        "HID\\DEVICE\\?",
        "HID\\DEVICE\\KEY\0",
        "HID\\DEVICE\\KEY EXTRA",
        "HID\\DEVICE\\KEY\\EXTRA",
    ] {
        assert!(InputPolicy::new(&[id]).is_err());
    }
    assert!(InputPolicy::new(&[]).is_err());
    assert!(InputPolicy::new(&["HID\\D\\K"; 9]).is_err());
    assert!(InputPolicy::new(&["HID\\D\\K", "hid\\d\\k"]).is_err());
    assert!(InputPolicy::new(&[&format!("HID\\D\\{}", "A".repeat(201))]).is_err());
}

#[test]
fn every_partial_write_is_recoverable_after_restart_including_ambiguous_failures() {
    for fail_after in [false, true] {
        for fail_at in 0..8 {
            let fixture = Fixture::default();
            fixture.0.borrow_mut().fail_at = Some(fail_at);
            fixture.0.borrow_mut().fail_after = fail_after;
            let mut engine = recovery(&fixture);
            engine.recover_pending().unwrap();
            assert_eq!(engine.arm_apply(100, 30), Err(Error::Platform));
            assert_eq!(engine.state(), State::RecoveryRequired);
            assert!(fixture.0.borrow().journal.is_some());
            drop(engine);
            // A restart's new requested profile cannot alter the recorded rollback.
            let different = InputPolicy::new(&["HID\\SYNTHETIC\\DIFFERENT"]).unwrap();
            let mut restarted = Recovery::new(
                fixture.clone(),
                PolicyBackend::new(fixture.clone(), different),
            );
            assert!(restarted.recover_pending().unwrap());
            assert!(fixture.0.borrow().entries.is_empty());
            assert!(fixture.0.borrow().journal.is_none());
        }
    }
}

#[test]
fn expiration_removes_deny_before_allowlist_and_never_enables_admin_override_or_storage() {
    let fixture = Fixture::default();
    let mut engine = recovery(&fixture);
    engine.recover_pending().unwrap();
    engine.arm_apply(100, 30).unwrap();
    assert_eq!(engine.state(), State::Applied);
    {
        let state = fixture.0.borrow();
        assert!(
            state
                .entries
                .iter()
                .all(|e| !e.name.contains("Admin") && !e.name.contains("Storage"))
        );
        assert_eq!(state.entries.len(), 8);
        assert_eq!(state.entries.last().unwrap().name, "DenyDeviceClasses");
    }
    assert!(engine.recover_due(130).unwrap());
    assert_eq!(
        fixture.0.borrow().removals.first().unwrap(),
        "DenyDeviceClasses"
    );
    assert_eq!(fixture.0.borrow().removals.last().unwrap(), "1");
}

#[test]
fn existing_admin_policy_or_drift_is_preserved_and_journal_retained() {
    let fixture = Fixture::default();
    fixture.0.borrow_mut().entries.push(foreign());
    let mut engine = recovery(&fixture);
    engine.recover_pending().unwrap();
    assert_eq!(engine.arm_apply(100, 30), Err(Error::Conflict));
    assert_eq!(fixture.0.borrow().writes, 0);
    assert!(fixture.0.borrow().journal.is_none());
    fixture.0.borrow_mut().entries.clear();
    engine.arm_apply(100, 30).unwrap();
    fixture.0.borrow_mut().entries.push(foreign());
    assert_eq!(engine.recover_due(130), Err(Error::Conflict));
    assert!(fixture.0.borrow().removals.is_empty());
    assert!(fixture.0.borrow().journal.is_some());
}

#[test]
fn changed_owned_value_cannot_be_deleted_as_ours_and_flush_failure_retains_intent() {
    let fixture = Fixture::default();
    let mut engine = recovery(&fixture);
    engine.recover_pending().unwrap();
    engine.arm_apply(100, 30).unwrap();
    fixture.0.borrow_mut().entries[0].data = vec![0, 0];
    assert_eq!(engine.recover_pending(), Err(Error::Conflict));
    assert!(fixture.0.borrow().removals.is_empty());

    let fixture = Fixture::default();
    fixture.0.borrow_mut().fail_flush = true;
    let mut engine = recovery(&fixture);
    engine.recover_pending().unwrap();
    assert_eq!(engine.arm_apply(100, 30), Err(Error::Platform));
    assert_eq!(engine.recover_pending(), Err(Error::Platform));
    assert!(fixture.0.borrow().journal.is_some());
    fixture.0.borrow_mut().fail_flush = false;
    assert!(engine.recover_pending().unwrap());
}

#[test]
fn malformed_record_and_changed_baseline_refuse_before_mutation() {
    let fixture = Fixture::default();
    let mut backend = PolicyBackend::new(fixture.clone(), policy());
    let mut record = [0; 2048];
    let size = backend.capture_into(&mut record).unwrap();
    for end in 0..size {
        assert_eq!(
            backend.restore_if_owned(&record[..end]),
            Err(Error::Corrupt)
        );
    }
    assert_eq!(
        backend.restore_if_owned(&record[..size + 1]),
        Err(Error::Corrupt)
    );
    fixture.0.borrow_mut().entries.push(foreign());
    assert_eq!(
        backend.apply_if_unchanged(&record[..size]),
        Err(Error::Conflict)
    );
    assert_eq!(fixture.0.borrow().writes, 0);
    assert!(fixture.0.borrow().removals.is_empty());
}
