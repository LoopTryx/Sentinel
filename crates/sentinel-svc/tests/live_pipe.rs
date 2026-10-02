#![cfg(windows)]
use sentinel_proto::rpc::encode_frame;
use sentinel_svc::live_pipe::{AuthenticatedClient, AuthenticatedPipe, connect_user};
use sentinel_svc::windows::OsIdentity;
use std::io::{Read, Write};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

fn name() -> String {
    format!(
        r"\\.\pipe\Sentinel-v1-user-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    )
}

#[test]
fn bounded_client_supports_sequential_large_responses() {
    let name = name();
    let mut pipe = AuthenticatedPipe::bind(&name).unwrap();
    let server = std::thread::spawn(move || {
        for _ in 0..2 {
            let request = pipe.receive(Duration::from_secs(2)).unwrap();
            assert_eq!(request.payload(), b"request");
            pipe.reply(&vec![b'x'; 128 * 1024], Duration::from_secs(2))
                .unwrap();
        }
    });
    let mut client = AuthenticatedClient::connect(&name).unwrap();
    for _ in 0..2 {
        assert_eq!(
            client.exchange(b"request", Duration::from_secs(2)).unwrap(),
            vec![b'x'; 128 * 1024]
        );
    }
    server.join().unwrap();
}

#[test]
fn bounded_client_disposes_disconnected_agent_channel() {
    let name = name();
    let mut pipe = AuthenticatedPipe::bind(&name).unwrap();
    let server = std::thread::spawn(move || {
        pipe.receive(Duration::from_secs(2)).unwrap();
    });
    let mut client = AuthenticatedClient::connect(&name).unwrap();
    let error = client
        .exchange(b"request", Duration::from_secs(2))
        .unwrap_err();
    assert!(matches!(
        error.kind(),
        std::io::ErrorKind::BrokenPipe | std::io::ErrorKind::UnexpectedEof
    ));
    assert_eq!(
        client
            .exchange(b"retry", Duration::from_secs(1))
            .unwrap_err()
            .kind(),
        std::io::ErrorKind::NotConnected
    );
    server.join().unwrap();
}

#[test]
fn bounded_client_write_times_out_when_agent_does_not_read() {
    let name = name();
    let _pipe = AuthenticatedPipe::bind(&name).unwrap();
    let mut client = AuthenticatedClient::connect(&name).unwrap();
    let started = std::time::Instant::now();
    assert_eq!(
        client
            .exchange(&vec![0; 1024 * 1024], Duration::from_millis(100))
            .unwrap_err()
            .kind(),
        std::io::ErrorKind::TimedOut
    );
    assert!(started.elapsed() < Duration::from_secs(2));
    assert_eq!(
        client
            .exchange(b"retry", Duration::from_secs(1))
            .unwrap_err()
            .kind(),
        std::io::ErrorKind::NotConnected
    );
}

#[test]
fn bounded_client_rejects_invalid_timeout_and_oversized_request() {
    for (payload, timeout, expected) in [
        (vec![0], Duration::ZERO, std::io::ErrorKind::InvalidInput),
        (
            vec![0],
            Duration::from_secs(31),
            std::io::ErrorKind::InvalidInput,
        ),
        (
            vec![0; 1024 * 1024 + 1],
            Duration::from_secs(1),
            std::io::ErrorKind::InvalidData,
        ),
    ] {
        let name = name();
        let _pipe = AuthenticatedPipe::bind(&name).unwrap();
        let mut client = AuthenticatedClient::connect(&name).unwrap();
        assert_eq!(
            client.exchange(&payload, timeout).unwrap_err().kind(),
            expected
        );
        assert_eq!(
            client
                .exchange(b"retry", Duration::from_secs(1))
                .unwrap_err()
                .kind(),
            std::io::ErrorKind::NotConnected
        );
    }
}

#[test]
fn actual_token_identity_and_framed_response_cross_live_pipe() {
    let identity = OsIdentity::current_process().unwrap();
    assert_ne!(
        identity.session_id, 0,
        "live user test requires an interactive session"
    );
    let name = name();
    let mut pipe = AuthenticatedPipe::bind(&name).unwrap();
    assert!(AuthenticatedPipe::bind(&name).is_err());
    let expected = format!("{}:{}", identity.sid, identity.session_id);
    let server = std::thread::spawn(move || {
        let request = pipe.receive(Duration::from_secs(3)).unwrap();
        assert_eq!(request.owner_ref(), expected);
        assert_eq!(request.payload(), b"actual-request");
        pipe.reply(b"actual-response", Duration::from_secs(3))
            .unwrap();
        assert_eq!(
            pipe.reply(b"duplicate", Duration::from_secs(1))
                .unwrap_err()
                .kind(),
            std::io::ErrorKind::PermissionDenied
        );
    });
    let mut client = connect_user(&name).unwrap();
    client
        .write_all(&encode_frame(b"actual-request").unwrap())
        .unwrap();
    let mut response = vec![0; 4 + b"actual-response".len()];
    client.read_exact(&mut response).unwrap();
    assert_eq!(
        sentinel_proto::rpc::decode_frame(&response).unwrap(),
        b"actual-response"
    );
    drop(client);
    server.join().unwrap();
}

#[test]
fn idle_connect_and_partial_request_have_read_deadlines() {
    let mut pipe = AuthenticatedPipe::bind(&name()).unwrap();
    let clock = std::time::Instant::now();
    assert_eq!(
        pipe.receive(Duration::from_millis(100))
            .err()
            .unwrap()
            .kind(),
        std::io::ErrorKind::TimedOut
    );
    assert!(clock.elapsed() < Duration::from_secs(2));
    drop(pipe);

    let name = name();
    let mut pipe = AuthenticatedPipe::bind(&name).unwrap();
    let mut client = connect_user(&name).unwrap();
    client.write_all(&[0, 0]).unwrap();
    assert_eq!(
        pipe.receive(Duration::from_millis(100))
            .err()
            .unwrap()
            .kind(),
        std::io::ErrorKind::TimedOut
    );
}

#[test]
fn oversized_header_is_rejected_without_waiting_for_body() {
    let name = name();
    let mut pipe = AuthenticatedPipe::bind(&name).unwrap();
    let mut client = connect_user(&name).unwrap();
    client.write_all(&1_048_577u32.to_be_bytes()).unwrap();
    assert_eq!(
        pipe.receive(Duration::from_secs(1)).err().unwrap().kind(),
        std::io::ErrorKind::InvalidData
    );
}

#[test]
fn stalled_response_reader_cannot_block_the_server_forever() {
    let name = name();
    let mut pipe = AuthenticatedPipe::bind(&name).unwrap();
    let mut client = connect_user(&name).unwrap();
    client
        .write_all(&encode_frame(b"request").unwrap())
        .unwrap();
    pipe.receive(Duration::from_secs(1)).unwrap();
    let clock = std::time::Instant::now();
    assert_eq!(
        pipe.reply(&vec![b'x'; 1048576], Duration::from_millis(100))
            .unwrap_err()
            .kind(),
        std::io::ErrorKind::TimedOut
    );
    assert!(clock.elapsed() < Duration::from_secs(2));
}
