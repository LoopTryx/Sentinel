use shield_agent::stdio::{AgentError, serve_once};
use shield_proto::rpc::{MAX_MESSAGE_BYTES, encode_frame};
use shield_proto::status::{StatusMode, StatusSnapshot};
use std::io::Cursor;
use std::io::Write;
use std::process::{Command, Stdio};

#[test]
fn fixture_status_round_trip_is_bounded_and_typed() {
    let request = br#"{"version":{"major":1,"minor":0},"method":"status_fixture"}"#;
    let mut output = Vec::new();
    serve_once(
        &mut Cursor::new(encode_frame(request).unwrap()),
        &mut output,
    )
    .unwrap();
    let payload = shield_proto::rpc::decode_frame(&output).unwrap();
    let status: StatusSnapshot = serde_json::from_slice(payload).unwrap();
    assert_eq!(status.mode, StatusMode::Fixture);
}

#[test]
fn unknown_and_oversized_requests_are_rejected() {
    let unknown = br#"{"version":{"major":1,"minor":0},"method":"policy_disable"}"#;
    assert_eq!(
        serve_once(
            &mut Cursor::new(encode_frame(unknown).unwrap()),
            &mut Vec::new()
        ),
        Err(AgentError::InvalidRequest)
    );
    let header = ((MAX_MESSAGE_BYTES + 1) as u32).to_be_bytes();
    assert_eq!(
        serve_once(&mut Cursor::new(header), &mut Vec::new()),
        Err(AgentError::Oversized)
    );
}

#[test]
fn incompatible_version_and_truncated_payload_are_rejected() {
    let incompatible = br#"{"version":{"major":2,"minor":0},"method":"status_fixture"}"#;
    assert_eq!(
        serve_once(
            &mut Cursor::new(encode_frame(incompatible).unwrap()),
            &mut Vec::new()
        ),
        Err(AgentError::UnsupportedVersion)
    );
    assert_eq!(
        serve_once(&mut Cursor::new([0, 0, 0, 2, b'{']), &mut Vec::new()),
        Err(AgentError::Truncated)
    );
}

#[test]
fn fixture_agent_process_returns_same_status_contract() {
    let request = br#"{"version":{"major":1,"minor":0},"method":"status_fixture"}"#;
    let mut child = Command::new(env!("CARGO_BIN_EXE_shield-agent"))
        .arg("--fixture-stdio")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(&encode_frame(request).unwrap())
        .unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    let actual: StatusSnapshot =
        serde_json::from_slice(shield_proto::rpc::decode_frame(&output.stdout).unwrap()).unwrap();
    let expected: StatusSnapshot =
        serde_json::from_str(include_str!("../../../data/fixtures/status.json")).unwrap();
    assert_eq!(actual, expected);
}
