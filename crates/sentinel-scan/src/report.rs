//! Converts trusted local scanner results into the output-only UI contract.
//! The adapter must authorize a native selection before scanning and reject
//! callbacks/results whose correlation does not match its active operation.
use crate::pipeline::{ScanResult, ScanState};
use sentinel_proto::scan_report::{FileScanOutcome, ScanReportCoverage, SelectedFileReport};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ReportBindingError;
impl std::fmt::Display for ReportBindingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("invalid scan correlation reference")
    }
}
impl std::error::Error for ReportBindingError {}

/// Correlation syntax only: these identifiers do not confer authority.
pub fn selected_file_report(
    result: &ScanResult,
    job_id: &str,
    selection_ref: &str,
) -> Result<SelectedFileReport, ReportBindingError> {
    if !valid_reference(job_id) || !valid_reference(selection_ref) {
        return Err(ReportBindingError);
    }
    let state = match result.state {
        ScanState::NoKnownFinding => FileScanOutcome::NoKnownFinding,
        ScanState::TestSignatureFound => FileScanOutcome::TestSignatureFound,
        ScanState::SkippedLimit => FileScanOutcome::SkippedLimit,
        ScanState::SkippedUnsupported => FileScanOutcome::SkippedUnsupported,
        ScanState::AccessError => FileScanOutcome::AccessError,
        ScanState::ChangedDuringScan => FileScanOutcome::ChangedDuringScan,
        ScanState::Cancelled => FileScanOutcome::Cancelled,
    };
    Ok(SelectedFileReport {
        job_id: job_id.to_owned(),
        selection_ref: selection_ref.to_owned(),
        state,
        coverage: ScanReportCoverage::Partial,
        bytes_read: result.bytes_read,
        sha256: result.sha256.clone(),
        files_visited: result.files_visited,
        files_checked: result.files_checked,
        files_skipped: result.files_skipped,
        access_errors: result.access_errors,
        engine_failures: result.engine_failures,
        full_signature_engine_active: result.full_signature_engine_active,
    })
}
fn valid_reference(value: &str) -> bool {
    (1..=64).contains(&value.len())
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
}
