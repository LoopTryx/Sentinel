#![cfg(windows)]
use sentinel_proto::rpc::encode_frame;
use sentinel_svc::live_pipe::{AuthenticatedPipe, connect_user};
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
