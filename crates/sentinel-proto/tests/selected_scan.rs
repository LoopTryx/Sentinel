use sentinel_proto::selected_scan::*;

#[test]
fn requests_refuse_paths_owners_and_nonopaque_refs() {
    let request: ScanStartRequest =
        serde_json::from_str(r#"{"selectionRef":"selection_1"}"#).unwrap();
    assert!(request.validate().is_ok());
    for value in ["", "C:/private/file", "../file", "ref with space"] {
        assert!(ScanStartRequest {
            selection_ref: value.into()
        }
        .validate()
        .is_err());
    }
    for json in [
        r#"{"selectionRef":"selection_1","owner":"main"}"#,
        r#"{"selectionRef":"selection_1","path":"secret"}"#,
    ] {
        assert!(serde_json::from_str::<ScanStartRequest>(json).is_err());
    }
    assert!(
        serde_json::from_str::<ScanSelectRequest>(r#"{"kind":"file","path":"secret"}"#).is_err()
    );
    assert!(serde_json::from_str::<ScanSelectRequest>(r#"{"kind":"remote"}"#).is_err());
}

fn running() -> ScanJobSnapshot {
    ScanJobSnapshot {
        selection_ref: "selection_1".into(),
        job_ref: "job_1".into(),
        state: ScanWorkerState::Running,
        cancellation_requested: false,
        current_file_bytes: "0".into(),
        reports: vec![],
    }
}

#[test]
fn acquisition_is_bounded_canonical_decimal_and_not_coverage() {
    assert!(running().validate().is_ok());
    for value in [
        "-1",
        "+1",
        "01",
        "18446744073709551616",
        "",
        "1.0",
        "8388609",
    ] {
        let mut bad = running();
        bad.current_file_bytes = value.into();
        assert!(bad.validate().is_err());
    }
    let mut finished = running();
    finished.state = ScanWorkerState::Finished;
    finished.cancellation_requested = true;
    assert!(finished.validate().is_ok());
    let json = serde_json::to_value(finished).unwrap();
    assert_eq!(json["state"], "finished");
    assert!(json["currentFileBytes"].is_string());
    assert!(json.get("protected").is_none());
    assert!(json.get("coverage").is_none());
    assert!(serde_json::from_str::<ScanJobSnapshot>(r#"{"selectionRef":"s","jobRef":"j","state":"running","cancellationRequested":false,"currentFileBytes":0,"reports":[]}"#).is_err());
}

#[test]
fn report_bounds_duplicates_and_invalid_nested_evidence_refuse() {
    use sentinel_proto::assessment::Coverage;
    use sentinel_proto::file_inspection::*;
    let report = FileInspectionSnapshot {
        report_ref: "report_0".into(),
        state: FileInspectionState::AccessError,
        verdict: FileInspectionVerdict::Unknown,
        coverage: Coverage::Unavailable,
        logical_bytes: "0".into(),
        inspected_bytes: "0".into(),
        sha256: None,
        evidence: None,
        findings: vec![],
    };
    let mut snapshot = running();
    snapshot.state = ScanWorkerState::Finished;
    snapshot.reports.push(report.clone());
    assert!(snapshot.validate().is_ok());
    snapshot.reports.push(report.clone());
    assert!(snapshot.validate().is_err());
    snapshot.reports = (0..66)
        .map(|n| {
            let mut item = report.clone();
            item.report_ref = format!("r_{n}");
            item
        })
        .collect();
    assert!(snapshot.validate().is_err());
    snapshot.reports = vec![report];
    snapshot.reports[0].verdict = FileInspectionVerdict::NoneObserved;
    assert!(snapshot.validate().is_err());
}
