use crate::engine::ScanReport;
use sentinel_proto::assessment::Coverage;
use sentinel_proto::file_inspection::{
    FileInspectionFinding as Finding, FileInspectionSnapshot, FileInspectionState as State,
    FileInspectionVerdict as Verdict, InspectedByteEvidence, InvalidFileInspection,
};

/// Output adapter only. The native caller binds the reference to its private
/// selected subject. No path, raw rule name/detail or file bytes cross this DTO.
pub fn inspection_snapshot(
    report_ref: &str,
    report: &ScanReport,
) -> Result<FileInspectionSnapshot, InvalidFileInspection> {
    let state = match report.state.as_str() {
        "completed" => State::Completed,
        "partial" => State::Partial,
        "cancelled" => State::Cancelled,
        "timed_out" => State::TimedOut,
        "busy" => State::Busy,
        "unsupported" => State::Unsupported,
        "failed" | "access_error" => State::AccessError,
        "changed" => State::Changed,
        "engine_failed" => State::EngineFailed,
        "limit_reached" => State::LimitReached,
        "depth_limit" => State::DepthLimit,
        _ => return Err(InvalidFileInspection),
    };
    if report.detections.len() > 64 || (state == State::Completed && !report.content_complete) {
        return Err(InvalidFileInspection);
    }
    let findings: Vec<_> = report
        .detections
        .iter()
        .map(|finding| {
            if finding.source == "hash-db" {
                return Finding::HashSignature;
            }
            match finding.name.as_str() {
                "EICAR-Test-File"
                | "EICAR_Antivirus_Test_File"
                | "CS_Sim_Eicar"
                | "Sim_Trojan_TestDropper"
                | "Sim_Ransomware_Demo" => Finding::SyntheticMarker,
                "Suspicious_PowerShell_Encoded_Run"
                | "Suspicious_Remote_Payload_Fetch"
                | "Suspicious_Scripted_File_Persistence"
                | "Encoded_Payload_Blob"
                | "Fake_Document_Macro_Lure" => Finding::ScriptIndicators,
                "Ransomware_Note_Indicators" => Finding::RansomNoteIndicators,
                "USB_AutoRun_Abuse" | "AutoRunLauncher" => Finding::AutorunIndicators,
                "DoubleExtension" => Finding::DisguisedFilename,
                "HighEntropyExecutable" => Finding::HighEntropyExecutable,
                "LargeZeroFilledRange" => Finding::LargeZeroFilledRange,
                "DisguisedExecutableHeader" => Finding::DisguisedExecutableHeader,
                _ => Finding::OtherLocalIndicator,
            }
        })
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect();
    let verdict = match report.verdict.as_str() {
        "clean" => Verdict::NoneObserved,
        "unknown" => Verdict::Unknown,
        "suspicious" => Verdict::Suspicious,
        "malicious" if findings.contains(&Finding::HashSignature) => Verdict::SignatureMatch,
        "malicious" if findings.contains(&Finding::SyntheticMarker) => Verdict::SyntheticTest,
        _ => return Err(InvalidFileInspection),
    };
    let evidence = report
        .content_evidence
        .as_ref()
        .map(|evidence| {
            if evidence.inspected_bytes != report.bytes_inspected
                || evidence.logical_bytes != report.size
            {
                return Err(InvalidFileInspection);
            }
            Ok(InspectedByteEvidence {
                zero_bytes: evidence.zero_bytes.to_string(),
                zero_permille: evidence.zero_permille,
                range_complete: evidence.complete,
                pe_header_present: evidence.executable_header,
            })
        })
        .transpose()?;
    let snapshot = FileInspectionSnapshot {
        report_ref: report_ref.into(),
        state,
        verdict,
        coverage: if evidence.is_some() {
            Coverage::Partial
        } else {
            Coverage::Unavailable
        },
        logical_bytes: report.size.to_string(),
        inspected_bytes: report.bytes_inspected.to_string(),
        sha256: (!report.sha256.is_empty()).then(|| report.sha256.clone()),
        evidence,
        findings,
    };
    snapshot.validate()?;
    Ok(snapshot)
}
