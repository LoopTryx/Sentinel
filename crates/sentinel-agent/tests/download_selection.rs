use sentinel_agent::download_selection::{DownloadIngressError, decode_download_observation};
#[test]
fn ingress_is_bounded_and_semantically_validated() {
    let valid = br#"{"sessionRef":"s-1","downloadRef":"d-1"}"#;
    assert_eq!(
        decode_download_observation(valid).unwrap().download_ref,
        "d-1"
    );
    assert_eq!(
        decode_download_observation(&vec![b' '; 513]),
        Err(DownloadIngressError::TooLarge)
    );
    for invalid in [
        br#"{"sessionRef":"","downloadRef":"d-1"}"#.as_slice(),
        br#"{"sessionRef":"s-1","downloadRef":"../secret"}"#,
        br#"{"sessionRef":"s-1","downloadRef":"d-1","path":"secret"}"#,
        b"\xff",
    ] {
        let error = decode_download_observation(invalid).unwrap_err();
        assert_eq!(error, DownloadIngressError::InvalidObservation);
        assert!(!format!("{error:?}").contains("secret"));
    }
}
