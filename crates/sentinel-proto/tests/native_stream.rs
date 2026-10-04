use sentinel_proto::native::{encode_chrome_frame, read_chrome_request};
use sentinel_proto::native_request::NativeRequest;
use std::io::{Cursor, Read};

#[test]
fn stream_preserves_duplicate_fields_for_validation() {
    for raw in [
        r#"{"version":{"major":1,"minor":0},"id":"a","id":"b","kind":"capabilities.list","payload":{}}"#,
        r#"{"version":{"major":1,"minor":0},"id":"a","kind":"url.assess","payload":{"url":"https://example.test/","url":"https://other.test/","subjectRef":"s"}}"#,
    ] {
        let frame = encode_chrome_frame(raw.as_bytes()).unwrap();
        assert!(read_chrome_request(&mut Cursor::new(frame)).is_err());
    }
}

#[test]
fn stream_consumes_one_frame_and_preserves_next_request() {
    let raw =
        br#"{"version":{"major":1,"minor":0},"id":"a","kind":"capabilities.list","payload":{}}"#;
    let frame = encode_chrome_frame(raw).unwrap();
    let mut reader = Cursor::new([frame.clone(), frame].concat());
    for _ in 0..2 {
        assert!(
            matches!(read_chrome_request(&mut reader).unwrap(), NativeRequest::Capabilities { id } if id == "a")
        );
    }
    assert!(read_chrome_request(&mut reader).is_err());
}

#[test]
fn oversized_header_never_reads_body() {
    struct HeaderOnly(Cursor<Vec<u8>>);
    impl Read for HeaderOnly {
        fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
            assert!(self.0.position() < 4, "oversized body was read");
            self.0.read(buf)
        }
    }
    let mut reader = HeaderOnly(Cursor::new(1_048_577u32.to_le_bytes().to_vec()));
    assert!(read_chrome_request(&mut reader).is_err());
}

#[test]
fn invalid_utf8_and_truncated_frames_fail_without_a_request() {
    for bytes in [vec![1, 0], vec![2, 0, 0, 0, b'{'], vec![1, 0, 0, 0, 255]] {
        assert!(read_chrome_request(&mut Cursor::new(bytes)).is_err());
    }
}
