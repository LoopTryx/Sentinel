# Focused scan screen and native binding fix

Owner responded "do whats best" to the explicit ScanView editing transfer question.
Engineer A took the focused scan screen integration and minimum native-dialog bridge
timeout adjustment; existing presentation classes and peer branch remain preserved.

Native selection requests and actions are single-flight. A selected private filename
is associated only with a successful runtime scan ID, a single report_0 and an
accepted file selection. Rejected replacement clears action authority. Folder
disposition refuses. Restore labels are retained only from successful quarantine.
Rust continues enforcing exact inspected subject/digest, expiry and one-use action
authority. No renderer approval or destination is accepted.

Real standalone C# regressions pass for accepted, stale, foreign report, folder,
malformed and rejected-replacement bindings. C# compilation passes. Advisory source
review found no remaining actionable label/authority race; designated B review is
still pending.

The screen reads canonical ScanJobSnapshot through the native bridge. The unchanged
closed runtime validator is extracted into a browser-safe module shared by native
process adapters and UI; generated contracts remain authoritative. Partial large
files display inspected/logical bytes and no full SHA. Single-file quarantine and
retained receipt restore controls call native dialogs; action bridge timeout is 60s
while Rust's preview remains limited to 30s and expired confirmation refuses.

Verification: UI13 tests across seven files PASS, including partial64MiB evidence
and mock UI action/receipt behavior. UI typecheck/build PASS. Seven actual Node/Rust
checks PASS including64MiB partial padding, disguised header, source-preserving
cancel/timeout and real HTTP encrypted removal/exact restore. Fresh native WebView
smoke PASS. Mock UI action tests are not OS consent acceptance.

Still pending: visible native picker/dialog approval and restore rehearsal,
designated peer review and main integration. Limits remain8MiB acquired per file
and64 files; this change does not claim expanded/unrestricted inspection, durable
restart recovery, or browser downloaded-byte inspection.

Further advisory review found a five-minute worker expiry that discards in-memory
restore authority. The new-scan guard is tested and correct but cannot solve expiry.
Native quarantine remains disabled with quarantine_recovery_lifetime_unavailable;
the screen explicitly reports that gate. UI action tests exercise the prepared
control wiring only, not enabled production removal. Durable recovery must be
implemented and reviewed before enabling destructive desktop quarantine.
