use sentinel_proto::assessment::Coverage;
use sentinel_proto::file_inspection::*;

fn completed() -> FileInspectionSnapshot {
    FileInspectionSnapshot {
        report_ref: "report_1".into(),
        state: FileInspectionState::Completed,
        verdict: FileInspectionVerdict::NoneObserved,
        coverage: Coverage::Partial,
        logical_bytes: "1".into(),
        inspected_bytes: "1".into(),
        sha256: Some("a".repeat(64)),
        evidence: Some(InspectedByteEvidence {
            zero_bytes: "0".into(),
            zero_permille: 0,
            range_complete: true,
            pe_header_present: false,
        }),
        findings: vec![],
    }
}

#[test]
fn counters_are_canonical_full_width_strings_with_consistent_evidence() {
    let good = completed();
    assert!(good.validate().is_ok());
    for value in ["-1", "+1", "01", "18446744073709551616", "", "1.0"] {
        let mut bad = good.clone();
        bad.logical_bytes = value.into();
        assert!(bad.validate().is_err(), "invalid counter {value}");
    }
    let mut wide = good.clone();
    wide.logical_bytes = u64::MAX.to_string();
    wide.state = FileInspectionState::Partial;
    wide.verdict = FileInspectionVerdict::Unknown;
    wide.sha256 = None;
    wide.evidence.as_mut().unwrap().range_complete = false;
    assert!(wide.validate().is_ok());
    let json = serde_json::to_value(wide).unwrap();
    assert!(json["logicalBytes"].is_string());
    let mut bad = good.clone();
    bad.evidence.as_mut().unwrap().zero_bytes = "2".into();
    assert!(bad.validate().is_err());
    let mut bad = good.clone();
    bad.evidence.as_mut().unwrap().zero_permille = 1001;
    assert!(bad.validate().is_err());
}

#[test]
fn partial_errors_and_opaque_references_cannot_claim_clean_or_full_coverage() {
    let good = completed();
    let mut bad = good.clone();
    bad.state = FileInspectionState::Partial;
    assert!(bad.validate().is_err());
    let mut bad = good.clone();
    bad.coverage = Coverage::Complete;
    assert!(bad.validate().is_err());
    let mut bad = good.clone();
    bad.state = FileInspectionState::AccessError;
    assert!(bad.validate().is_err());
    let mut bad = good.clone();
    bad.report_ref = "C:/private/secret".into();
    assert!(bad.validate().is_err());
    let mut bad = good.clone();
    bad.sha256 = Some("Z".repeat(64));
    assert!(bad.validate().is_err());
    let mut bad = good.clone();
    bad.findings = vec![FileInspectionFinding::OtherLocalIndicator; 65];
    assert!(bad.validate().is_err());
}

#[test]
fn content_findings_require_their_measured_evidence() {
    let mut bad = completed();
    bad.verdict = FileInspectionVerdict::Suspicious;
    bad.findings = vec![FileInspectionFinding::LargeZeroFilledRange];
    assert!(bad.validate().is_err());
    bad.findings = vec![FileInspectionFinding::DisguisedExecutableHeader];
    assert!(bad.validate().is_err());
    bad.findings = vec![FileInspectionFinding::ScriptIndicators];
    bad.evidence = None;
    bad.coverage = Coverage::Unavailable;
    bad.inspected_bytes = "0".into();
    bad.sha256 = None;
    bad.state = FileInspectionState::AccessError;
    assert!(bad.validate().is_err());
}

#[test]
fn pe_header_evidence_requires_the_minimum_inspected_layout() {
    let mut report = completed();
    report.logical_bytes = "1".into();
    report.inspected_bytes = "1".into();
    report.evidence.as_mut().unwrap().pe_header_present = true;
    report.verdict = FileInspectionVerdict::Suspicious;
    report.findings = vec![FileInspectionFinding::DisguisedExecutableHeader];
    assert!(report.validate().is_err());
    report.logical_bytes = "68".into();
    report.inspected_bytes = "68".into();
    assert!(report.validate().is_ok());
}
