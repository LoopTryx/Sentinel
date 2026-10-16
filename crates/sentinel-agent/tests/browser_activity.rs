use sentinel_agent::browser_activity::{ActivityError, BrowserActivityInbox};
use sentinel_proto::browser_activity::{BrowserActivityEvent, BrowserActivityKind};
fn event(seq: u32) -> BrowserActivityEvent {
    BrowserActivityEvent {
        session_ref: "session-1".into(),
        sequence: seq,
        navigation_ref: "nav-1".into(),
        assessment_ref: "assessment-1".into(),
        kind: BrowserActivityKind::NavigationHeld,
    }
}
#[test]
fn reconnect_replay_and_foreign_sessions_do_not_duplicate_or_replace() {
    let mut inbox = BrowserActivityInbox::new("session-1").unwrap();
    assert_eq!(inbox.accept(event(1)), Ok(true));
    assert_eq!(inbox.accept(event(1)), Ok(false));
    let mut changed = event(1);
    changed.kind = BrowserActivityKind::PotentiallyHarmful;
    assert_eq!(inbox.accept(changed), Err(ActivityError::Replay));
    let mut foreign = event(2);
    foreign.session_ref = "session-2".into();
    assert_eq!(inbox.accept(foreign), Err(ActivityError::WrongSession));
    assert_eq!(inbox.events().count(), 1);
}
#[test]
fn inbox_is_bounded_and_retired_sequences_remain_rejected() {
    let mut inbox = BrowserActivityInbox::new("session-1").unwrap();
    for i in 1..=130 {
        inbox.accept(event(i)).unwrap();
    }
    assert_eq!(inbox.events().count(), 128);
    assert_eq!(inbox.omitted(), 2);
    assert_eq!(inbox.accept(event(1)), Err(ActivityError::Replay));
    assert_eq!(inbox.events().next().unwrap().sequence, 3);
}
#[test]
fn invalid_evidence_cannot_echo_private_content_or_advance_sequence() {
    let mut inbox = BrowserActivityInbox::new("session-1").unwrap();
    let mut bad = event(1);
    bad.assessment_ref = "https://private.example/token".into();
    assert_eq!(inbox.accept(bad), Err(ActivityError::InvalidEvent));
    assert_eq!(inbox.accept(event(0)), Err(ActivityError::InvalidEvent));
    assert_eq!(inbox.accept(event(1)), Ok(true));
    assert!(BrowserActivityInbox::new("bad session").is_err());
    let mut too_long = event(2);
    too_long.navigation_ref = "x".repeat(65);
    assert_eq!(inbox.accept(too_long), Err(ActivityError::InvalidEvent));
}
