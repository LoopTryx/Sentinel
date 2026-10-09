use sentinel_proto::download_selection::DownloadObservation;
#[test]
fn correlation_is_bounded_and_private_fields_are_rejected() {
    let valid = r#"{"sessionRef":"session-1","downloadRef":"download-1"}"#;
    let observed: DownloadObservation = serde_json::from_str(valid).unwrap();
    assert!(observed.validate().is_ok());
    for value in [
        r#"{"sessionRef":"session-1","downloadRef":"download-1","path":"private"}"#,
        r#"{"sessionRef":"session-1","downloadRef":"download-1","url":"private"}"#,
    ] {
        assert!(serde_json::from_str::<DownloadObservation>(value).is_err());
    }
    for value in ["", "../private", "é", &"x".repeat(65)] {
        let observed = DownloadObservation {
            session_ref: "session-1".into(),
            download_ref: value.into(),
        };
        assert!(observed.validate().is_err());
    }
}
