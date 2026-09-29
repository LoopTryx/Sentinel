use shield_proto::assessment::{Assessment, CheckState, Coverage, Risk};
use shield_proto::jobs::{Job, JobState};
use shield_proto::rpc::{
    FrameError, MAX_MESSAGE_BYTES, ProtocolError, ProtocolVersion, RpcMethod, decode_frame,
    encode_frame,
};
use shield_proto::status::{StatusMode, StatusSnapshot};

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

#[test]
fn shared_status_fixture_has_a_typed_fixture_mode() {
    let report: StatusSnapshot =
        serde_json::from_str(include_str!("../../../data/fixtures/status.json")).unwrap();
    assert_eq!(report.mode, StatusMode::Fixture);
    assert_eq!(report.assessment.coverage, Coverage::Unavailable);
    assert_eq!(report.job.unwrap().state, JobState::Queued);
    assert!(serde_json::from_str::<StatusMode>("\"protected\"").is_err());
}

#[test]
fn rpc_frames_reject_oversize_truncation_and_trailing_bytes() {
    let payload = b"status";
    let frame = encode_frame(payload).unwrap();
    assert_eq!(decode_frame(&frame), Ok(payload.as_slice()));
    assert_eq!(
        decode_frame(&frame[..frame.len() - 1]),
        Err(FrameError::Truncated)
    );
    let mut extra = frame.clone();
    extra.push(0);
    assert_eq!(decode_frame(&extra), Err(FrameError::TrailingBytes));
    let largest_allowed = vec![0; MAX_MESSAGE_BYTES];
    assert_eq!(
        decode_frame(&encode_frame(&largest_allowed).unwrap()),
        Ok(largest_allowed.as_slice())
    );
    assert_eq!(
        encode_frame(&vec![0; MAX_MESSAGE_BYTES + 1]),
        Err(FrameError::Oversized)
    );
    assert_eq!(decode_frame(&[0, 16, 0, 1]), Err(FrameError::Oversized));
}

#[test]
fn rpc_method_allowlist_rejects_arbitrary_commands() {
    assert_eq!(
        serde_json::from_str::<RpcMethod>("\"capabilities.list\"").unwrap(),
        RpcMethod::CapabilitiesList
    );
    assert!(serde_json::from_str::<RpcMethod>("\"execute\"").is_err());
    assert!(serde_json::from_str::<RpcMethod>("\"registry.write\"").is_err());
}
