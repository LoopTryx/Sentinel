use sentinel_proto::native_pending::{PendingError, PendingRequests};
use sentinel_proto::native_request::NativeRequest;
use std::time::{Duration, Instant};
fn request(id: &str) -> NativeRequest {
    NativeRequest::Capabilities { id: id.into() }
}

#[test]
fn completion_is_single_use_and_timeout_cannot_deliver_late_work() {
    let now = Instant::now();
    let mut session = PendingRequests::new(now).unwrap();
    let first = session.admit(&request("first"), now).unwrap();
    let duplicate = first.clone();
    assert_eq!(session.complete(first, now), Ok("first".into()));
    assert_eq!(session.complete(duplicate, now), Err(PendingError::Unknown));
    assert_eq!(
        session.admit(&request("first"), now).unwrap_err(),
        PendingError::Replay
    );
    let late = session.admit(&request("late"), now).unwrap();
    assert_eq!(
        session.complete(late, now + Duration::from_secs(5)),
        Err(PendingError::Expired)
    );
    assert_eq!(session.pending_count(), 0);
}

#[test]
fn bounded_admission_keeps_replay_history_after_expiry() {
    let now = Instant::now();
    let mut session = PendingRequests::new(now).unwrap();
    for i in 0..32 {
        session.admit(&request(&format!("r{i}")), now).unwrap();
    }
    assert_eq!(
        session.admit(&request("extra"), now).unwrap_err(),
        PendingError::Busy
    );
    let later = now + Duration::from_secs(5);
    assert_eq!(session.expire(later).unwrap().len(), 32);
    assert_eq!(
        session.admit(&request("r0"), later).unwrap_err(),
        PendingError::Replay
    );
    for i in 32..256 {
        let ticket = session.admit(&request(&format!("r{i}")), later).unwrap();
        session.complete(ticket, later).unwrap();
    }
    assert_eq!(
        session.admit(&request("new"), later).unwrap_err(),
        PendingError::SessionBudget
    );
}

#[test]
fn foreign_tickets_and_disconnect_cannot_release_another_request() {
    let now = Instant::now();
    let mut a = PendingRequests::new(now).unwrap();
    let mut b = PendingRequests::new(now).unwrap();
    let at = a.admit(&request("same"), now).unwrap();
    let bt = b.admit(&request("same"), now).unwrap();
    assert_eq!(b.complete(at.clone(), now), Err(PendingError::Foreign));
    assert_eq!(b.pending_count(), 1);
    assert_eq!(b.complete(bt, now), Ok("same".into()));
    a.disconnect();
    assert_eq!(a.pending_count(), 0);
    assert_eq!(a.complete(at, now), Err(PendingError::Closed));
    assert_eq!(
        a.admit(&request("next"), now).unwrap_err(),
        PendingError::Closed
    );
    assert_eq!(a.expire(now), Err(PendingError::Closed));
}

#[test]
fn rollback_and_invalid_ids_do_not_mutate_admission() {
    let now = Instant::now();
    let mut session = PendingRequests::new(now).unwrap();
    assert_eq!(
        session.admit(&request(&"x".repeat(129)), now).unwrap_err(),
        PendingError::InvalidId
    );
    assert_eq!(
        session.admit(&request("bad/id"), now).unwrap_err(),
        PendingError::InvalidId
    );
    let ticket = session
        .admit(&request("private_ref"), now + Duration::from_secs(1))
        .unwrap();
    assert!(!format!("{ticket:?}").contains("private_ref"));
    assert!(!format!("{session:?}").contains("private_ref"));
    assert_eq!(session.expire(now), Err(PendingError::ClockRollback));
    assert_eq!(session.pending_count(), 1);
    assert_eq!(
        session.complete(ticket, now + Duration::from_secs(1)),
        Ok("private_ref".into())
    );
}

#[test]
fn validated_url_ingress_expires_once_without_retaining_the_payload() {
    let now = Instant::now();
    let mut session = PendingRequests::new(now).unwrap();
    let request = sentinel_proto::native_request::validate_request(
        br#"{"version":{"major":1,"minor":0},"id":"url1","kind":"url.assess","payload":{"subjectRef":"subject1","url":"https://example.test/private?secret=invented"}}"#,
    ).unwrap();
    let ticket = session.admit(&request, now).unwrap();
    assert!(!format!("{session:?} {ticket:?}").contains("invented"));
    assert!(
        session
            .expire(now + Duration::from_secs(4))
            .unwrap()
            .is_empty()
    );
    let deadline = now + Duration::from_secs(5);
    assert_eq!(session.expire(deadline).unwrap(), vec!["url1"]);
    assert!(session.expire(deadline).unwrap().is_empty());
    assert_eq!(
        session.complete(ticket, deadline),
        Err(PendingError::Unknown)
    );
    assert_eq!(
        session.admit(&request, deadline).unwrap_err(),
        PendingError::Replay
    );
}

#[test]
fn cancellation_consumes_only_its_ticket_and_suppresses_late_completion() {
    let now = Instant::now();
    let mut session = PendingRequests::new(now).unwrap();
    let ticket = session.admit(&request("dismissed"), now).unwrap();
    let late = ticket.clone();
    let other = session.admit(&request("still_current"), now).unwrap();
    assert_eq!(session.cancel(ticket, now), Ok(()));
    assert_eq!(session.pending_count(), 1);
    assert_eq!(
        session.complete(late.clone(), now),
        Err(PendingError::Unknown)
    );
    assert_eq!(session.cancel(late, now), Err(PendingError::Unknown));
    assert_eq!(
        session.admit(&request("dismissed"), now).unwrap_err(),
        PendingError::Replay
    );
    assert_eq!(session.complete(other, now), Ok("still_current".into()));
    assert!(
        session
            .expire(now + Duration::from_secs(5))
            .unwrap()
            .is_empty()
    );
}

#[test]
fn cancellation_respects_session_clock_deadline_and_disconnect() {
    let now = Instant::now();
    let later = now + Duration::from_secs(1);
    let mut a = PendingRequests::new(now).unwrap();
    let mut b = PendingRequests::new(now).unwrap();
    let at = a.admit(&request("same"), later).unwrap();
    let bt = b.admit(&request("same"), now).unwrap();
    assert_eq!(b.cancel(at.clone(), now), Err(PendingError::Foreign));
    assert_eq!(b.pending_count(), 1);
    assert_eq!(a.cancel(at.clone(), now), Err(PendingError::ClockRollback));
    assert_eq!(a.pending_count(), 1);
    assert_eq!(a.complete(at, later), Ok("same".into()));
    assert_eq!(
        b.cancel(bt.clone(), now + Duration::from_secs(5)),
        Err(PendingError::Expired)
    );
    assert_eq!(b.pending_count(), 0);
    assert_eq!(
        b.complete(bt, now + Duration::from_secs(5)),
        Err(PendingError::Unknown)
    );
    let closed = a.admit(&request("closed"), later).unwrap();
    a.disconnect();
    assert_eq!(a.cancel(closed, later), Err(PendingError::Closed));
}

#[test]
fn cancellation_releases_pending_capacity_without_resetting_session_budget() {
    let now = Instant::now();
    let mut session = PendingRequests::new(now).unwrap();
    let mut tickets = Vec::new();
    for i in 0..32 {
        tickets.push(session.admit(&request(&format!("cancel{i}")), now).unwrap());
    }
    assert_eq!(
        session.admit(&request("extra"), now).unwrap_err(),
        PendingError::Busy
    );
    session.cancel(tickets.remove(0), now).unwrap();
    let extra = session.admit(&request("extra"), now).unwrap();
    assert_eq!(session.pending_count(), 32);
    session.cancel(extra, now).unwrap();
    for ticket in tickets {
        session.cancel(ticket, now).unwrap();
    }
    for i in 33..256 {
        let ticket = session.admit(&request(&format!("cancel{i}")), now).unwrap();
        session.cancel(ticket, now).unwrap();
    }
    assert_eq!(session.pending_count(), 0);
    assert_eq!(
        session.admit(&request("new"), now).unwrap_err(),
        PendingError::SessionBudget
    );
}
