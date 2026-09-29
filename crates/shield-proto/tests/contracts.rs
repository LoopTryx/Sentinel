use shield_proto::assessment::{Assessment, CheckState, Coverage, Risk};
use shield_proto::jobs::{Job, JobState};
use shield_proto::rpc::{ProtocolError, ProtocolVersion};

#[test]
fn assessment_round_trips_without_claiming_unchecked_safety() {
    let assessment = Assessment::unknown("subject-1", "2026-09-29T00:00:00Z");
    let json = serde_json::to_string(&assessment).unwrap();
    let decoded: Assessment = serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.risk, Risk::Unknown);
    assert_eq!(decoded.coverage, Coverage::Unavailable);
    assert_eq!(decoded.checks[0].state, CheckState::Skipped);
    assert_eq!(decoded, assessment);
}

#[test]
fn invalid_risk_is_rejected() {
    assert!(serde_json::from_str::<Risk>("\"safe\"").is_err());
}

#[test]
fn incompatible_protocol_major_is_rejected() {
    let local = ProtocolVersion::new(1, 0);
    assert_eq!(
        local.negotiate(ProtocolVersion::new(2, 0)),
        Err(ProtocolError::MajorMismatch)
    );
    assert_eq!(
        local.negotiate(ProtocolVersion::new(1, 1)),
        Ok(ProtocolVersion::new(1, 0))
    );
}

#[test]
fn job_states_are_monotonic_and_cancelled_job_cannot_complete() {
    let mut job = Job::new("job-1", "user-1");
    assert_eq!(job.state, JobState::Queued);
    job.start().unwrap();
    job.cancel().unwrap();
    assert_eq!(job.state, JobState::Cancelled);
    assert!(job.complete().is_err());
    assert!(job.start().is_err());
}
