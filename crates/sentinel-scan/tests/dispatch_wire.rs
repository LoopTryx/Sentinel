use sentinel_proto::scan_report::{
    FileScanOutcome, LocalScanControlState, ScanReportCoverage, SelectedFileReport,
};
use sentinel_scan::{
    dispatch::{DispatchSnapshot, NativeScanReport, ScanTicket},
    dispatch_wire::dispatch_snapshot,
};

fn ticket() -> ScanTicket {
    ScanTicket {
        job_id: "job-1".into(),
        selection_ref: "selection-1".into(),
    }
}
fn snapshot() -> DispatchSnapshot {
    DispatchSnapshot {
        state: LocalScanControlState::TimedOut,
        worker_returned: true,
        abandoned: false,
        progress: None,
        report: Some(NativeScanReport::File(SelectedFileReport {
            job_id: "job-1".into(),
            selection_ref: "selection-1".into(),
            state: FileScanOutcome::Cancelled,
            coverage: ScanReportCoverage::Partial,
            bytes_read: u64::MAX,
            sha256: None,
            files_visited: 1,
            files_checked: 0,
            files_skipped: 0,
            access_errors: 0,
            engine_failures: 0,
            full_signature_engine_active: false,
        })),
    }
}
#[test]
fn timeout_returned_report_keeps_tag_binding_and_precise_wire_counters() {
    let wire = dispatch_snapshot(&ticket(), &snapshot()).unwrap();
    let json = serde_json::to_value(wire).unwrap();
    assert_eq!(json["ticket"]["jobId"], "job-1");
    assert_eq!(json["state"], "timed_out");
    assert_eq!(json["workerReturned"], true);
    assert_eq!(json["report"]["kind"], "file");
    assert_eq!(json["report"]["data"]["state"], "cancelled");
    assert_eq!(json["report"]["data"]["bytesRead"], "18446744073709551615");
    assert_eq!(json["report"]["data"]["coverage"], "partial");
}
#[test]
fn mismatched_and_unreturned_reports_fail_closed_without_reference_echo() {
    let mut s = snapshot();
    if let Some(NativeScanReport::File(r)) = s.report.as_mut() {
        r.selection_ref = "another-selection".into();
    }
    assert_eq!(
        dispatch_snapshot(&ticket(), &s).unwrap_err().to_string(),
        "invalid native scan snapshot"
    );
    let mut s = snapshot();
    s.worker_returned = false;
    assert!(dispatch_snapshot(&ticket(), &s).is_err());
    let mut bad = ticket();
    bad.job_id = "private/path".into();
    assert!(dispatch_snapshot(&bad, &snapshot()).is_err());
    let mut s = snapshot();
    s.abandoned = true;
    assert!(dispatch_snapshot(&ticket(), &s).is_err());
}

#[test]
fn lifecycle_nulls_bounds_and_fixed_errors_have_unambiguous_serialization() {
    use sentinel_proto::scan_dispatch::LocalScanDispatchError;
    use sentinel_scan::{dispatch::DispatchError, dispatch_wire::dispatch_error};
    let mut s = snapshot();
    s.report = None;
    s.worker_returned = false;
    let json = serde_json::to_value(dispatch_snapshot(&ticket(), &s).unwrap()).unwrap();
    assert!(json["report"].is_null() && json["progress"].is_null());
    assert_eq!(json["workerReturned"], false);
    s.state = LocalScanControlState::Returned;
    assert!(dispatch_snapshot(&ticket(), &s).is_err());
    s.worker_returned = true;
    s.state = LocalScanControlState::Running;
    assert!(dispatch_snapshot(&ticket(), &s).is_err());
    let mut s = snapshot();
    if let Some(NativeScanReport::File(r)) = s.report.as_mut() {
        r.sha256 = Some("private-name".repeat(100));
    }
    assert!(dispatch_snapshot(&ticket(), &s).is_err());
    for (native, expected) in [
        (DispatchError::Busy, "busy"),
        (DispatchError::InvalidSelection, "invalid_selection"),
        (DispatchError::InvalidDeadline, "invalid_deadline"),
        (DispatchError::WrongOperation, "wrong_operation"),
        (DispatchError::Unavailable, "unavailable"),
        (DispatchError::WorkerFailed, "worker_failed"),
    ] {
        assert_eq!(
            serde_json::to_value(dispatch_error(native)).unwrap(),
            expected
        );
    }
    assert_eq!(
        serde_json::to_value(LocalScanDispatchError::InvalidSnapshot).unwrap(),
        "invalid_snapshot"
    );
}

#[test]
fn directory_output_preserves_progress_and_rejects_unbounded_or_mismatched_details() {
    use sentinel_proto::{
        scan_progress::{DirectoryScanProgress, DirectoryScanStage},
        scan_report::{BoundDirectoryProgress, ScanReportFinding, SelectedDirectoryReport},
    };
    let progress = DirectoryScanProgress {
        stage: DirectoryScanStage::Finished,
        entries_visited: 1,
        files_visited: 1,
        files_checked: 1,
        files_skipped: 0,
        access_errors: 0,
        engine_failures: 0,
        bytes_read: u64::MAX,
        traversal_complete: true,
        cancelled: false,
        limit_reached: false,
    };
    let mut s = DispatchSnapshot {
        state: LocalScanControlState::Returned,
        worker_returned: true,
        abandoned: false,
        progress: Some(BoundDirectoryProgress {
            job_id: "job-1".into(),
            selection_ref: "selection-1".into(),
            progress: progress.clone(),
        }),
        report: Some(NativeScanReport::Directory(SelectedDirectoryReport {
            job_id: "job-1".into(),
            selection_ref: "selection-1".into(),
            progress,
            coverage: ScanReportCoverage::Partial,
            full_signature_engine_active: false,
            findings: vec![],
            findings_omitted: u64::MAX,
        })),
    };
    let json = serde_json::to_value(dispatch_snapshot(&ticket(), &s).unwrap()).unwrap();
    assert_eq!(json["report"]["kind"], "directory");
    assert_eq!(
        json["progress"]["progress"]["bytesRead"],
        "18446744073709551615"
    );
    assert_eq!(
        json["report"]["data"]["findingsOmitted"],
        "18446744073709551615"
    );
    s.progress.as_mut().unwrap().job_id = "different-job".into();
    assert!(dispatch_snapshot(&ticket(), &s).is_err());
    s.progress.as_mut().unwrap().job_id = "job-1".into();
    s.progress.as_mut().unwrap().progress.files_checked = 0;
    assert!(dispatch_snapshot(&ticket(), &s).is_err());
    s.progress = None;
    if let Some(NativeScanReport::Directory(r)) = s.report.as_mut() {
        r.findings = vec![
            ScanReportFinding {
                finding_ref: "finding-1".into(),
                state: FileScanOutcome::TestSignatureFound
            };
            257
        ];
    }
    assert!(dispatch_snapshot(&ticket(), &s).is_err());
}
