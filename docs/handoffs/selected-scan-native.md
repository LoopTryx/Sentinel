# Selected scan native contract

Authoritative Rust: crates/sentinel-proto/src/selected_scan.rs. Bindings are
generated under packages/contracts/src/generated; never hand-edit them.
This contract is implemented/tested. These new commands are **not registered**
in Tauri yet; the existing scan_path command is not this interface. Keep this
API's scan capability unavailable until native dispatch and supported journeys
are verified. No protection, quarantine or release authority comes from a DTO.

## Signatures and safe examples

Native adapter signatures to implement:

```text
scan_select(request: ScanSelectRequest) -> Result<Option<ScanSelection>, ScanError>
scan_start(request: ScanStartRequest) -> Result<ScanJobReference, ScanError>
scan_poll(request: ScanJobReference) -> Result<ScanJobSnapshot, ScanError>
scan_cancel(request: ScanJobReference) -> Result<ScanCancelResponse, ScanError>
```

Select request: `{"kind":"file"}` or `{"kind":"directory"}`. Native opens the
real picker; picker cancellation returns null. Result example:
`{"selectionRef":"selection_demo_1","kind":"file"}`. These sample references
are illustrative only; never preload them as authorized selections.

Start request: `{"selectionRef":"selection_demo_1"}`. Result:
`{"jobRef":"job_demo_1"}`. Poll and cancel use that exact jobRef:
`{"jobRef":"job_demo_1"}`. Cancel acknowledgment example:
`{"jobRef":"job_demo_1","cancellationRequested":true}`.

Running snapshot example:

```json
{
  "selectionRef": "selection_demo_1",
  "jobRef": "job_demo_1",
  "state": "running",
  "cancellationRequested": false,
  "currentFileBytes": "65536",
  "reports": []
}
```

Terminal access-error example (worker exited, inspection unavailable):

```json
{
  "selectionRef": "selection_demo_1",
  "jobRef": "job_demo_1",
  "state": "finished",
  "cancellationRequested": false,
  "currentFileBytes": "0",
  "reports": [{
    "reportRef": "report_0",
    "state": "access_error",
    "verdict": "unknown",
    "coverage": "unavailable",
    "logicalBytes": "0",
    "inspectedBytes": "0",
    "sha256": null,
    "evidence": null,
    "findings": []
  }]
}
```

## States, bounds and errors

Worker states are running/finished/failed. Finished means joined worker exit;
evaluate every nested FileInspectionSnapshot for partial, cancelled, timed_out,
changed, unsupported, access_error, engine_failed and traversal/byte limits.
An empty report vector proves no inspected scope. Never render finished as safe.
Cancellation is sticky request acknowledgment, not immediate worker termination.
Admission remains busy until actual worker exit is joined; a late cancel must not
relabel already finished inspection results. No guessed total or percentage.

currentFileBytes is a canonical unsigned decimal string, maximum8388608; it is
the latest file's acquired bytes, not aggregate scope or verified inspection.
Snapshots contain at most65 validated, uniquely referenced reports. References
are1..64 ASCII alphanumeric/underscore/hyphen characters; validity is correlation,
not authorization. Unknown request fields (including paths/owners) are rejected.
Validate DTOs after deserialization and before serializing native output.

Error shape: `{"code":"selection_unavailable"}`. Closed codes: unavailable,
busy, invalid_request, selection_unavailable, job_unavailable,
inspection_unavailable. Missing/expired/replayed/foreign selection references
share selection_unavailable; foreign/missing/obsolete jobs share job_unavailable.
No raw OS message, path, file content or credential may enter an error. Invalid
requests refuse before picker/filesystem work; unavailable refuses without fake
jobs. Picker cancellation is null, distinct from an error.

## Integration entry points and required acceptance

Current internal engine controller: sentinel_av::scan_jobs::SelectedJobs with
select/start/poll/cancel and maintain(Instant::now()). The adapter must derive a
trusted window/session caller itself, preserve the consumed selectionRef in its
private job association, map JobSnapshot terminal flags, and map each private
ScanReport through sentinel_av::inspection_wire::inspection_snapshot. Raw reports
must not cross the wire. Ignore stale responses unless BOTH jobRef/selectionRef
match the active operation. Report refs are scoped to that private association;
they never authorize reopening/removing a file.

Implemented internal bridge: `SelectedJobs::poll_wire(owner: &str, job_ref: &str)
-> Result<ScanJobSnapshot, ScanError>`. It validates the reference, checks private
owner/job association via poll, derives selectionRef from the consumed native
selection retained with ActiveJob, and converts actual reports using scoped
report_N references. Every nested report and final DTO is validated; bad conversion
returns inspection_unavailable, malformed reference invalid_request, and foreign
or obsolete job job_unavailable. No caller-provided selectionRef is used in output.
The native owner parameter remains trusted adapter context, not browser input.

Actual harmless Windows file job exercises this bridge: both references and real
inspection byte count match, nested DTO validation passes, foreign caller refuses,
and serialized output contains neither original file name nor parent path. Initial
test failed because the bridge did not exist; seven selected-job tests pass after
implementation. This proves library conversion, not registered Tauri/authenticated
IPC or installed desktop/browser acceptance. Raw poll remains internal native use
only; callers must use poll_wire for transport.

Implemented typed controls: `SelectedJobs::start_wire(owner, &ScanStartRequest,
native_now) -> Result<ScanJobReference, ScanError>` and
`cancel_wire(owner, &ScanJobReference) -> Result<ScanCancelResponse, ScanError>`.
Both validate input before controller work. Start maps busy/selection refusal/
worker unavailability to closed codes; cancel returns only the validated jobRef
and sticky acknowledgment. No raw controller error is transported. Native caller
identity/time remains trusted adapter context; never deserialize it from a page.

The actual held-worker test uses typed start/cancel, rejects foreign selection,
checks exact acknowledgment correlation and invalid path-shaped references, and
retains admission until the joined worker exits. Seven selected-job checks pass.
Initial test failed missing controls; no Tauri dispatch, permission policy or
installed acceptance is proved by these library functions.

Directory-selection root retention is now implemented in the internal controller:
picker-supplied native paths must be absolute supported local paths; missing,
nondirectory and reparse leaves refuse. Windows opens a read-only directory with
backup semantics plus open-reparse-point and read sharing only. The selection
transfers that root handle into the worker lifetime, preventing root rename while
selected/scanning and releasing it at worker exit or selection expiry/drop.
Actual harmless root-rename regression failed first, then eight job tests pass,
including real directory bytes in a validated canonical report and successful
rename after completion. No device policy or E: operation is involved.

This root-handle retention does not bind every ancestor/descendant lookup: current
directory traversal still enumerates the private path and opens bounded children.
Parent alias/junction/rename races and descendant identity across each acquisition
need further retained-ancestry/handle-bound traversal evidence. Do not treat this
increment as full directory subject authorization or installed protection. Native
bootstrap/lock files remain part of active PR41 ownership, pending exact transfer;
PR59 is verifier-only and PR62 does not edit those native files.

Use one controller and a bounded idle maintenance timer, trusted native clocks,
actual picker authorization and held subject identity. File handles are retained
already; directory root/descendant and picker-to-open ancestry binding remain
integration work. Native shutdown, bounded isolated worker execution and signature
availability need evidence. No client-submitted owner/path/clock, autonomous cloud
fallback or inspection-based automatic quarantine. Explicit quarantine/restore
needs separately reviewed subject/action authorization.

Implemented acceptance: cargo test -p sentinel-proto --test selected_scan plus
proto export tests generate the bindings; tests reject malformed refs/owners/paths,
numeric/noncanonical/overflow acquisition, report duplicates/limits and invalid
nested unknown-to-clean evidence. This is contract evidence, not installed IPC.

Required runtime acceptance: select owned harmless file/folder via actual picker;
start once and refuse replay/foreign/stale refs; observe real progress/results;
cancel during reading and retain busy admission until actual exit; verify expiry,
locked-file error, timeout/partial/skipped traversal and original subject identity;
check both clients receive the same supported download-byte report. Record fresh
native launches and browser/desktop evidence; do not use this document or DTO tests
as proof those journeys happened. Keep Defender enabled and CRYPTIC(E:) untouched.
