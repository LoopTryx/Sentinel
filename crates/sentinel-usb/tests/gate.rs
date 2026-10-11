use sentinel_usb::{Error, Gate, Interface, Interfaces, ScanResult, State};

fn setup() -> (Gate, sentinel_usb::Connection) {
    let mut gate = Gate::new([1; 16], 100).unwrap();
    let connection = gate
        .connect(
            Interfaces {
                storage: true,
                hid: true,
                other: true,
            },
            100,
        )
        .unwrap();
    (gate, connection)
}
fn inspected(gate: &mut Gate, connection: sentinel_usb::Connection) {
    gate.confirm_hold(connection, Interface::Storage, 100)
        .unwrap();
    let job = gate.begin_inspection(connection, 100).unwrap();
    gate.finish_inspection(connection, job, ScanResult::CompleteNoFindings, 101)
        .unwrap();
}
#[test]
fn observations_are_not_holds_and_composite_permissions_stay_separate() {
    let (mut gate, connection) = setup();
    assert_eq!(gate.snapshot(connection).unwrap().storage, State::Observed);
    assert_eq!(gate.begin_inspection(connection, 100), Err(Error::NotHeld));
    inspected(&mut gate, connection);
    gate.confirm_hold(connection, Interface::Hid, 101).unwrap();
    let intent = gate
        .request_release(connection, Interface::Storage, true, 102)
        .unwrap();
    assert_eq!(gate.snapshot(connection).unwrap().storage, State::Held);
    gate.complete_release(intent, true, 102).unwrap();
    let snapshot = gate.snapshot(connection).unwrap();
    assert_eq!(snapshot.storage, State::Released);
    assert_eq!(snapshot.hid, State::Held);
    assert!(snapshot.unsupported_interfaces);
}
#[test]
fn partial_failed_and_finding_reports_never_enable_release() {
    for result in [
        ScanResult::Incomplete,
        ScanResult::Failed,
        ScanResult::Findings,
    ] {
        let (mut gate, connection) = setup();
        gate.confirm_hold(connection, Interface::Storage, 100)
            .unwrap();
        let job = gate.begin_inspection(connection, 100).unwrap();
        gate.finish_inspection(connection, job, result, 100)
            .unwrap();
        assert!(matches!(
            gate.request_release(connection, Interface::Storage, true, 101),
            Err(Error::InspectionRequired)
        ));
    }
}
#[test]
fn detached_and_reconnected_devices_cannot_reuse_reports() {
    let (mut gate, old) = setup();
    inspected(&mut gate, old);
    gate.disconnect(old).unwrap();
    let current = gate
        .connect(
            Interfaces {
                storage: true,
                hid: true,
                other: false,
            },
            102,
        )
        .unwrap();
    assert_ne!(old, current);
    assert_eq!(gate.snapshot(old), Err(Error::UnknownConnection));
    gate.confirm_hold(current, Interface::Storage, 102).unwrap();
    assert!(matches!(
        gate.request_release(current, Interface::Storage, true, 102),
        Err(Error::InspectionRequired)
    ));
}
#[test]
fn replaced_and_invalidated_jobs_cannot_publish_old_results() {
    let (mut gate, connection) = setup();
    gate.confirm_hold(connection, Interface::Storage, 100)
        .unwrap();
    let old = gate.begin_inspection(connection, 100).unwrap();
    assert_eq!(gate.begin_inspection(connection, 100), Err(Error::Busy));
    gate.invalidate_inspection(connection).unwrap();
    let current = gate.begin_inspection(connection, 100).unwrap();
    assert_ne!(old, current);
    assert_eq!(
        gate.finish_inspection(connection, old, ScanResult::CompleteNoFindings, 101),
        Err(Error::WrongJob)
    );
    gate.finish_inspection(connection, current, ScanResult::CompleteNoFindings, 101)
        .unwrap();
}
#[test]
fn stale_and_clock_rollback_invalidate_decisions() {
    let (mut gate, connection) = setup();
    inspected(&mut gate, connection);
    assert!(matches!(
        gate.request_release(connection, Interface::Storage, true, 222),
        Err(Error::InspectionRequired)
    ));
    assert!(matches!(
        gate.request_release(connection, Interface::Hid, true, 99),
        Err(Error::ClockRollback)
    ));
    assert_eq!(gate.snapshot(connection).unwrap().storage, State::Gap);
}
#[test]
fn no_authorization_no_release_and_hid_approval_is_explicit() {
    let (mut gate, connection) = setup();
    inspected(&mut gate, connection);
    assert!(matches!(
        gate.request_release(connection, Interface::Storage, false, 102),
        Err(Error::Unauthorized)
    ));
    assert!(matches!(
        gate.request_release(connection, Interface::Hid, true, 102),
        Err(Error::NotHeld)
    ));
    gate.confirm_hold(connection, Interface::Hid, 102).unwrap();
    let intent = gate
        .request_release(connection, Interface::Hid, true, 102)
        .unwrap();
    gate.complete_release(intent, true, 102).unwrap();
    assert_eq!(gate.snapshot(connection).unwrap().storage, State::Held);
}
#[test]
fn failed_or_delayed_release_is_a_gap_not_a_false_hold() {
    let (mut gate, connection) = setup();
    inspected(&mut gate, connection);
    let intent = gate
        .request_release(connection, Interface::Storage, true, 102)
        .unwrap();
    assert!(matches!(
        gate.request_release(connection, Interface::Storage, true, 102),
        Err(Error::Busy)
    ));
    assert_eq!(
        gate.complete_release(intent, false, 102),
        Err(Error::PlatformFailure)
    );
    assert_eq!(gate.snapshot(connection).unwrap().storage, State::Gap);
    gate.confirm_hold(connection, Interface::Storage, 103)
        .unwrap();
    assert!(matches!(
        gate.request_release(connection, Interface::Storage, true, 103),
        Err(Error::InspectionRequired)
    ));
}
#[test]
fn drift_invalidates_inflight_approval_and_service_runs_are_distinct() {
    let (mut gate, connection) = setup();
    inspected(&mut gate, connection);
    let intent = gate
        .request_release(connection, Interface::Storage, true, 102)
        .unwrap();
    gate.policy_lost();
    assert_eq!(
        gate.complete_release(intent, true, 102),
        Err(Error::StaleIntent)
    );
    let other = Gate::new([2; 16], 100).unwrap();
    assert_eq!(other.snapshot(connection), Err(Error::UnknownConnection));
}
#[test]
fn capacity_and_invalid_configuration_are_bounded() {
    assert!(Gate::new([0; 16], 0).is_err());
    let mut gate = Gate::new([3; 16], 0).unwrap();
    for _ in 0..64 {
        gate.connect(
            Interfaces {
                storage: false,
                hid: true,
                other: false,
            },
            0,
        )
        .unwrap();
    }
    assert_eq!(
        gate.connect(
            Interfaces {
                storage: false,
                hid: true,
                other: false
            },
            0
        ),
        Err(Error::Capacity)
    );
}

#[test]
fn expired_proposals_are_refused_before_action_and_late_success_is_a_gap() {
    let (mut gate, connection) = setup();
    inspected(&mut gate, connection);
    let intent = gate
        .request_release(connection, Interface::Storage, true, 102)
        .unwrap();
    assert_eq!(intent.target(), (connection, Interface::Storage));
    gate.revalidate_release(&intent, 102).unwrap();
    assert_eq!(
        gate.revalidate_release(&intent, 222),
        Err(Error::InspectionRequired)
    );
    assert_eq!(gate.snapshot(connection).unwrap().storage, State::Held);
    assert_eq!(
        gate.complete_release(intent, true, 222),
        Err(Error::StaleIntent)
    );
    assert_eq!(gate.snapshot(connection).unwrap().storage, State::Gap);
    let (mut gate, connection) = setup();
    inspected(&mut gate, connection);
    let intent = gate
        .request_release(connection, Interface::Storage, true, 102)
        .unwrap();
    assert_eq!(
        gate.complete_release(intent, true, 222),
        Err(Error::InspectionRequired)
    );
    assert_eq!(gate.snapshot(connection).unwrap().storage, State::Gap);
}

#[test]
fn missing_interfaces_and_cross_connection_jobs_are_rejected() {
    let (mut gate, connection) = setup();
    let hid_only = gate
        .connect(
            Interfaces {
                storage: false,
                hid: true,
                other: false,
            },
            100,
        )
        .unwrap();
    assert_eq!(
        gate.confirm_hold(hid_only, Interface::Storage, 100),
        Err(Error::Invalid)
    );
    gate.confirm_hold(connection, Interface::Storage, 100)
        .unwrap();
    let job = gate.begin_inspection(connection, 100).unwrap();
    assert_eq!(
        gate.finish_inspection(hid_only, job, ScanResult::CompleteNoFindings, 100),
        Err(Error::WrongJob)
    );
    gate.finish_inspection(connection, job, ScanResult::CompleteNoFindings, 100)
        .unwrap();
    let intent = gate
        .request_release(connection, Interface::Storage, true, 100)
        .unwrap();
    gate.invalidate_inspection(connection).unwrap();
    assert_eq!(
        gate.revalidate_release(&intent, 100),
        Err(Error::StaleIntent)
    );
    assert_eq!(gate.snapshot(connection).unwrap().storage, State::Gap);
}

#[test]
fn superseded_action_callback_cannot_leave_a_new_hold_falsely_asserted() {
    let (mut gate, connection) = setup();
    inspected(&mut gate, connection);
    let old = gate
        .request_release(connection, Interface::Storage, true, 102)
        .unwrap();
    gate.confirm_hold(connection, Interface::Storage, 103)
        .unwrap();
    assert_eq!(
        gate.complete_release(old, true, 103),
        Err(Error::StaleIntent)
    );
    assert_eq!(gate.snapshot(connection).unwrap().storage, State::Gap);
}
