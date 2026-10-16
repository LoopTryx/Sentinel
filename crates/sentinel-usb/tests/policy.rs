use sentinel_usb::{
    policy::{Entry, InputPolicy, PolicyBackend, Registry, entries_from_record},
    recovery::{Backend, Error, Recovery, State, Store},
};
use std::{cell::RefCell, rc::Rc};

#[test]
fn usb_hid_scope_compiles_only_usb_compatible_deny_and_preserves_recovery() {
    use sentinel_usb::policy::RestrictiveApprovalBackend;
    let fixture = Fixture::default();
    let ids = ["USB\\VID_0001&PID_0001&MI_00\\SYNTHETIC"];
    let mut backend = PolicyBackend::new(fixture.clone(), InputPolicy::usb_hid(&ids).unwrap());
    let mut bytes = [0; 4072];
    let length = backend.capture_into(&mut bytes).unwrap();
    assert_eq!(&bytes[..8], b"SNTINP03");
    let entries = entries_from_record(&bytes[..length]).unwrap();
    assert_eq!(entries.len(), 6);
    assert!(
        entries
            .iter()
            .all(|e| !e.key.contains("Classes") && !e.name.contains("Classes"))
    );
    let deny = entries.iter().find(|e| e.key == "DenyDeviceIDs").unwrap();
    assert_eq!(deny.name, "1");
    assert_eq!(
        deny.data,
        "USB\\Class_03"
            .encode_utf16()
            .chain([0])
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>()
    );
    assert!(
        RestrictiveApprovalBackend::new(
            fixture.clone(),
            InputPolicy::new(&ids).unwrap(),
            InputPolicy::usb_hid(&[ids[0], "USB\\VID_0001&PID_0002\\SYNTHETIC"]).unwrap()
        )
        .is_err()
    );
    fixture.0.borrow_mut().journal = Some(vec![1]);
    backend.apply_if_unchanged(&bytes[..length]).unwrap();
    backend.verify_applied().unwrap();
    backend.restore_if_owned(&bytes[..length]).unwrap();
    backend.verify_restored(&bytes[..length]).unwrap();
    assert!(InputPolicy::usb_hid(&["USB\\*"]).is_err());
}

#[test]
fn default_policy_denies_only_keyboard_and_mouse_classes() {
    let fixture = Fixture::default();
    let mut backend = PolicyBackend::new(fixture.clone(), policy());
    let mut record = [0; 4072];
    let size = backend.capture_into(&mut record).unwrap();
    assert_eq!(&record[..8], b"SNTINP02");
    assert_eq!(entries_from_record(&record[..size]).unwrap().len(), 7);
    assert!(entries_from_record(&record[..size - 1]).is_err());
    let mut unknown = record;
    unknown[7] = b'9';
    assert!(entries_from_record(&unknown[..size]).is_err());
    fixture.0.borrow_mut().journal = Some(vec![1]);
    backend.apply_if_unchanged(&record[..size]).unwrap();
    let state = fixture.0.borrow();
    let classes: Vec<_> = state
        .entries
        .iter()
        .filter(|e| e.key == "DenyDeviceClasses")
        .collect();
    assert_eq!(classes.len(), 2);
    assert!(!classes.iter().any(|e| {
        String::from_utf16_lossy(
            &e.data
                .as_chunks::<2>()
                .0
                .iter()
                .map(|b| u16::from_le_bytes([b[0], b[1]]))
                .collect::<Vec<_>>(),
        )
        .contains("745a17a0")
    }));
}

#[test]
fn usb_hid_partial_mutations_recover_with_different_default_scope() {
    for fail_after in [false, true] {
        for fail_at in 0..6 {
            let fixture = Fixture::default();
            fixture.0.borrow_mut().fail_at = Some(fail_at);
            fixture.0.borrow_mut().fail_after = fail_after;
            let mut engine = Recovery::new(
                fixture.clone(),
                PolicyBackend::new(
                    fixture.clone(),
                    InputPolicy::usb_hid(&["USB\\SYNTHETIC\\INTERFACE"]).unwrap(),
                ),
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
fn legacy_three_class_record_recovers_and_cannot_apply_as_new_scope() {
    let fixture = Fixture::default();
    let id = b"HID\\SYNTHETIC\\KEYBOARD";
    let mut record = b"SNTINP01".to_vec();
    record.push(1);
    record.push(id.len() as u8);
    record.extend_from_slice(id);
    let mut backend = PolicyBackend::new(fixture.clone(), policy());
    assert_eq!(backend.apply_if_unchanged(&record), Err(Error::Conflict));
    let entry = |key: &str, name: &str, value: &str| Entry {
        key: key.into(),
        name: name.into(),
        kind: 1,
        data: value
            .encode_utf16()
            .chain([0])
            .flat_map(u16::to_le_bytes)
            .collect(),
    };
    let mut entries = vec![entry(
        "AllowInstanceIDs",
        "1",
        std::str::from_utf8(id).unwrap(),
    )];
    for (i, class) in [
        "{745a17a0-74d3-11d0-b6fe-00a0c90f57da}",
        "{4d36e96b-e325-11ce-bfc1-08002be10318}",
        "{4d36e96f-e325-11ce-bfc1-08002be10318}",
    ]
    .iter()
    .enumerate()
    {
        entries.push(entry("DenyDeviceClasses", &(i + 1).to_string(), class));
    }
    for name in [
        "AllowDenyLayered",
        "AllowInstanceIDs",
        "DenyDeviceClassesRetroactive",
        "DenyDeviceClasses",
    ] {
        entries.push(Entry {
            key: String::new(),
            name: name.into(),
            kind: 4,
            data: 1u32.to_le_bytes().to_vec(),
        });
    }
    assert!(entries_from_record(&record).unwrap() == entries);
    fixture.0.borrow_mut().entries = entries.clone();
    // Old append-only journals must restore the old three-class baseline too.
    let extra = b"HID\\SYNTHETIC\\MOUSE";
    let mut next = record.clone();
    next[8] = 2;
    next.push(extra.len() as u8);
    next.extend_from_slice(extra);
    let mut restrictive = b"SNTLKG01".to_vec();
    restrictive.push(1);
    restrictive.extend_from_slice(&next);
    fixture.0.borrow_mut().entries.push(entry(
        "AllowInstanceIDs",
        "2",
        std::str::from_utf8(extra).unwrap(),
    ));
    backend.restore_if_owned(&restrictive).unwrap();
    backend.verify_restored(&restrictive).unwrap();
    assert!(fixture.0.borrow().entries == entries);
    backend.restore_if_owned(&record).unwrap();
    backend.verify_restored(&record).unwrap();
    assert!(fixture.0.borrow().entries.is_empty());
}

#[test]
fn restrictive_approval_recovery_preserves_last_known_good_deny_rules() {
    use sentinel_usb::policy::RestrictiveApprovalBackend;
    for fail_after in [false, true] {
        for fail_at in 0..2 {
            let fixture = Fixture::default();
            let mut initial = recovery(&fixture);
            initial.recover_pending().unwrap();
            initial.arm_apply(100, 30).unwrap();
            let baseline = fixture.0.borrow().entries.clone();
            fixture.0.borrow_mut().journal = None;
            fixture.0.borrow_mut().writes = 0;
            fixture.0.borrow_mut().fail_at = Some(fail_at);
            fixture.0.borrow_mut().fail_after = fail_after;
            let next = || {
                InputPolicy::new(&[
                    "HID\\SYNTHETIC\\KEYBOARD",
                    "HID\\SYNTHETIC\\MOUSE",
                    "HID\\SYNTHETIC\\BOARD",
                ])
                .unwrap()
            };
            let mut engine = Recovery::new(
                fixture.clone(),
                RestrictiveApprovalBackend::new(fixture.clone(), policy(), next()).unwrap(),
            );
            engine.recover_pending().unwrap();
            assert_eq!(engine.arm_apply(200, 30), Err(Error::Platform));
            drop(engine);
            let mut restarted = Recovery::new(
                fixture.clone(),
                RestrictiveApprovalBackend::new(fixture.clone(), policy(), next()).unwrap(),
            );
            assert!(restarted.recover_pending().unwrap());
            assert!(fixture.0.borrow().entries == baseline);
            assert!(fixture.0.borrow().journal.is_none());
            assert!(
                !fixture
                    .0
                    .borrow()
                    .removals
                    .iter()
                    .any(|name| name == "DenyDeviceClasses")
            );
        }
    }
}

#[test]
fn restrictive_approval_rejects_reordering_removal_and_unrelated_drift() {
    use sentinel_usb::policy::RestrictiveApprovalBackend;
    let fixture = Fixture::default();
    assert!(RestrictiveApprovalBackend::new(fixture.clone(), policy(), policy()).is_err());
    let reordered =
        InputPolicy::new(&["HID\\SYNTHETIC\\MOUSE", "HID\\SYNTHETIC\\KEYBOARD"]).unwrap();
    assert!(RestrictiveApprovalBackend::new(fixture.clone(), policy(), reordered).is_err());
    let mut initial = recovery(&fixture);
    initial.recover_pending().unwrap();
    initial.arm_apply(100, 30).unwrap();
    let baseline = fixture.0.borrow().entries.clone();
    fixture.0.borrow_mut().journal = None;
    let next = || InputPolicy::new(&["HID\\SYNTHETIC\\KEYBOARD", "HID\\SYNTHETIC\\MOUSE"]).unwrap();
    let mut engine = Recovery::new(
        fixture.clone(),
        RestrictiveApprovalBackend::new(fixture.clone(), policy(), next()).unwrap(),
    );
    engine.recover_pending().unwrap();
    engine.arm_apply(200, 30).unwrap();
    fixture.0.borrow_mut().entries.push(foreign());
    assert_eq!(engine.recover_pending(), Err(Error::Conflict));
    assert!(fixture.0.borrow().journal.is_some());
    fixture.0.borrow_mut().entries.pop();
    assert!(engine.recover_pending().unwrap());
    assert!(fixture.0.borrow().entries == baseline);
}

#[test]
fn restrictive_update_refuses_legacy_scope_record_before_mutation() {
    use sentinel_usb::policy::RestrictiveApprovalBackend;
    let fixture = Fixture::default();
    let mut initial = recovery(&fixture);
    initial.recover_pending().unwrap();
    initial.arm_apply(100, 30).unwrap();
    let baseline = fixture.0.borrow().entries.clone();
    let next = InputPolicy::new(&["HID\\SYNTHETIC\\KEYBOARD", "HID\\SYNTHETIC\\MOUSE"]).unwrap();
    let mut update = RestrictiveApprovalBackend::new(fixture.clone(), policy(), next).unwrap();
    let mut bytes = [0; 4072];
    let length = update.capture_into(&mut bytes).unwrap();
    bytes[9..17].copy_from_slice(b"SNTINP01");
    assert_eq!(
        update.apply_if_unchanged(&bytes[..length]),
        Err(Error::Conflict)
    );
    assert!(fixture.0.borrow().entries == baseline);
}

#[test]
fn restrictive_record_bounds_corruption_expiry_and_failed_flush() {
    use sentinel_usb::policy::RestrictiveApprovalBackend;
    let mut exact = approvals(20, 200);
    exact.push(approvals(21, 33).pop().unwrap());
    let baseline =
        || InputPolicy::new(&exact[..20].iter().map(String::as_str).collect::<Vec<_>>()).unwrap();
    let next = InputPolicy::new(&exact.iter().map(String::as_str).collect::<Vec<_>>()).unwrap();
    assert!(RestrictiveApprovalBackend::new(Fixture::default(), baseline(), next).is_ok());
    let base = baseline();
    exact[20].push('B');
    let next = InputPolicy::new(&exact.iter().map(String::as_str).collect::<Vec<_>>()).unwrap();
    assert!(RestrictiveApprovalBackend::new(Fixture::default(), base, next).is_err());

    let fixture = Fixture::default();
    let mut initial = recovery(&fixture);
    initial.recover_pending().unwrap();
    initial.arm_apply(100, 30).unwrap();
    let baseline = fixture.0.borrow().entries.clone();
    fixture.0.borrow_mut().journal = None;
    let next = InputPolicy::new(&["HID\\SYNTHETIC\\KEYBOARD", "HID\\SYNTHETIC\\MOUSE"]).unwrap();
    let mut adapter = RestrictiveApprovalBackend::new(fixture.clone(), policy(), next).unwrap();
    let mut bytes = [0; 4072];
    let length = adapter.capture_into(&mut bytes).unwrap();
    for position in [0, 8, 9] {
        let mut corrupt = bytes;
        corrupt[position] = 0;
        assert!(adapter.restore_if_owned(&corrupt[..length]).is_err());
        assert!(fixture.0.borrow().entries == baseline);
    }
    let mut engine = Recovery::new(fixture.clone(), adapter);
    engine.recover_pending().unwrap();
    engine.arm_apply(200, 30).unwrap();
    assert!(!engine.recover_due(229).unwrap());
    fixture.0.borrow_mut().fail_flush = true;
    assert_eq!(engine.recover_due(230), Err(Error::Platform));
    assert!(fixture.0.borrow().entries == baseline);
    assert!(fixture.0.borrow().journal.is_some());
    fixture.0.borrow_mut().fail_flush = false;
    assert!(engine.recover_pending().unwrap());
    assert!(fixture.0.borrow().entries == baseline);
    assert!(fixture.0.borrow().journal.is_none());
}

#[test]
fn recovery_only_backend_dispatches_restrictive_journal_without_apply_permission() {
    use sentinel_usb::policy::RestrictiveApprovalBackend;
    let fixture = Fixture::default();
    let mut initial = recovery(&fixture);
    initial.recover_pending().unwrap();
    initial.arm_apply(100, 30).unwrap();
    let baseline = fixture.0.borrow().entries.clone();
    fixture.0.borrow_mut().journal = None;
    let next = InputPolicy::new(&["HID\\SYNTHETIC\\KEYBOARD", "HID\\SYNTHETIC\\MOUSE"]).unwrap();
    let mut update = RestrictiveApprovalBackend::new(fixture.clone(), policy(), next).unwrap();
    let mut record = [0; 4072];
    let length = update.capture_into(&mut record).unwrap();
    fixture.0.borrow_mut().journal = Some(vec![1]);
    update.apply_if_unchanged(&record[..length]).unwrap();
    let mut receiver = PolicyBackend::new(fixture.clone(), policy());
    assert!(receiver.apply_if_unchanged(&record[..length]).is_err());
    receiver.restore_if_owned(&record[..length]).unwrap();
    receiver.verify_restored(&record[..length]).unwrap();
    assert!(fixture.0.borrow().entries == baseline);
}

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
        for fail_at in 0..38 {
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
    assert_eq!(fixture.0.borrow().entries.len(), 38);
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
        for fail_at in 0..7 {
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
        assert_eq!(state.entries.len(), 7);
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

#[test]
fn exact_usb_block_record_never_compiles_a_class_deny_or_implicit_allow() {
    let target = "USB\\VID_0001&PID_0001&MI_00\\SYNTHETIC";
    let fixture = Fixture::default();
    let mut backend = PolicyBackend::new(
        fixture,
        InputPolicy::blocked_usb_instances(&[target]).unwrap(),
    );
    let mut bytes = [0; 4072];
    let length = backend.capture_into(&mut bytes).unwrap();
    assert_eq!(&bytes[..8], b"SNTINP04");
    let entries = entries_from_record(&bytes[..length]).unwrap();
    assert_eq!(entries.len(), 3);
    assert!(
        entries
            .iter()
            .all(|e| e.key == "DenyInstanceIDs" || e.key.is_empty())
    );
    assert!(entries.iter().all(|e| !e.name.contains("Classes")
        && !e.name.contains("DeviceIDs")
        && !e.name.contains("Allow")));
    assert_eq!(
        entries
            .iter()
            .filter(|e| e.key == "DenyInstanceIDs")
            .count(),
        1
    );
    assert!(InputPolicy::blocked_usb_instances(&["USB\\ROOT_HUB30\\TEST"]).is_err());
    assert!(InputPolicy::blocked_usb_instances(&[target, target]).is_err());
    assert!(InputPolicy::blocked_usb_instances(&["USB\\VID_0001&PID_0001\\*"]).is_err());
}

#[test]
fn exact_instance_partial_updates_recover_without_touching_another_target() {
    for fail_after in [false, true] {
        for fail_at in 0..4 {
            let fixture = Fixture::default();
            fixture.0.borrow_mut().fail_at = Some(fail_at);
            fixture.0.borrow_mut().fail_after = fail_after;
            let mut engine = Recovery::new(
                fixture.clone(),
                PolicyBackend::new(
                    fixture.clone(),
                    InputPolicy::blocked_usb_instances(&[
                        "USB\\VID_0001&PID_0001&MI_00\\SYNTHETIC",
                    ])
                    .unwrap(),
                ),
            );
            engine.recover_pending().unwrap();
            let _ = engine.arm_apply(100, 30);
            drop(engine);
            fixture.0.borrow_mut().fail_at = None;
            let mut restarted = recovery(&fixture);
            restarted.recover_pending().unwrap();
            assert!(fixture.0.borrow().entries.is_empty());
            assert!(fixture.0.borrow().journal.is_none());
        }
    }
}
