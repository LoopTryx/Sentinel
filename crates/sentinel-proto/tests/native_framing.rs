use sentinel_proto::native::{
    NativeReadError, decode_chrome_frame, encode_chrome_frame, read_chrome_json,
};
use sentinel_proto::rpc::{FrameError, MAX_MESSAGE_BYTES};

#[test]
fn chrome_uses_little_endian_byte_length_and_accepts_binary_headers() {
    let frame = encode_chrome_frame("é".as_bytes()).unwrap();
    assert_eq!(frame, [2, 0, 0, 0, 0xc3, 0xa9]);
    assert_eq!(decode_chrome_frame(&frame).unwrap(), "é".as_bytes());
    let mut binary = vec![128, 0, 0, 0];
    binary.extend([b' '; 128]);
    assert_eq!(decode_chrome_frame(&binary).unwrap().len(), 128);
}

#[test]
fn oversized_header_is_rejected_without_reading_any_payload() {
    struct HeaderOnly {
        offset: usize,
    }
    impl std::io::Read for HeaderOnly {
        fn read(&mut self, output: &mut [u8]) -> std::io::Result<usize> {
            assert!(self.offset < 4, "oversized body must not be read");
            let header = [1, 0, 16, 0];
            let count = output.len().min(4 - self.offset);
            output[..count].copy_from_slice(&header[self.offset..self.offset + count]);
            self.offset += count;
            Ok(count)
        }
    }
    assert!(matches!(
        read_chrome_json(&mut HeaderOnly { offset: 0 }),
        Err(NativeReadError::Frame(FrameError::Oversized))
    ));
}

#[test]
fn streaming_json_rejects_invalid_utf8_json_and_truncated_bodies() {
    for payload in [b"{\"id\":\"fake\",BROKEN".as_slice(), &[0xff, 0xfe]] {
        let frame = encode_chrome_frame(payload).unwrap();
        assert!(matches!(
            read_chrome_json(&mut frame.as_slice()),
            Err(NativeReadError::InvalidJson)
        ));
    }
    assert!(matches!(
        read_chrome_json(&mut [2, 0, 0, 0, b'{'].as_slice()),
        Err(NativeReadError::Io(_))
    ));
    let frame = encode_chrome_frame("{\"label\":\"é\"}".as_bytes()).unwrap();
    assert_eq!(
        read_chrome_json(&mut frame.as_slice()).unwrap()["label"],
        "é"
    );
}

#[test]
fn native_assessment_vector_is_complete_and_has_an_opaque_subject() {
    let envelope: serde_json::Value = serde_json::from_str(include_str!(
        "../../../data/fixtures/native-assessment.json"
    ))
    .unwrap();
    let assessment: sentinel_proto::assessment::Assessment =
        serde_json::from_value(envelope["payload"].clone()).unwrap();
    assert_eq!(assessment.subject_ref, "url-subject-1");
    assert_eq!(assessment.risk, sentinel_proto::assessment::Risk::Unknown);
    assert_eq!(
        assessment.coverage,
        sentinel_proto::assessment::Coverage::Unavailable
    );
    assert_eq!(
        assessment.checks[0].state,
        sentinel_proto::assessment::CheckState::Skipped
    );
    assert_eq!(
        assessment.expires_at.as_deref(),
        Some("2026-10-02T12:00:05Z")
    );
}

#[test]
fn chrome_frames_reject_truncation_trailing_and_oversize() {
    assert_eq!(decode_chrome_frame(&[1, 0, 0]), Err(FrameError::Truncated));
    assert_eq!(
        decode_chrome_frame(&[1, 0, 0, 0]),
        Err(FrameError::Truncated)
    );
    assert_eq!(
        decode_chrome_frame(&[0, 0, 0, 0, 1]),
        Err(FrameError::TrailingBytes)
    );
    assert_eq!(
        decode_chrome_frame(&[1, 0, 16, 0]),
        Err(FrameError::Oversized)
    );
    let cap = vec![b' '; MAX_MESSAGE_BYTES];
    assert_eq!(
        decode_chrome_frame(&encode_chrome_frame(&cap).unwrap()).unwrap(),
        cap
    );
    assert_eq!(
        encode_chrome_frame(&vec![0; MAX_MESSAGE_BYTES + 1]),
        Err(FrameError::Oversized)
    );
}
