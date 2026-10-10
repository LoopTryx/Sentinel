# Runnable demo candidate, 10 October 2026

Candidate: `artifacts/Sentinel-Demo-20261010-195100` (local, unpublished).

The native console was rebuilt, launched from the portable package and left open.
Its native evidence reported navigation=True, heading=Console and backend=demo_runtime;
Windows reported a nonzero main window handle. All 153 packaged manifest files
matched their SHA-256 values before launch. The fresh native smoke check passed.
Windows PowerShell 5.1 launcher identity compatibility passed.

Nine focused runtime, native-runtime and native-action-service tests passed with
the staged real Rust inspection executable. Sandbox-only attempts could not
connect to localhost; the authorized unsandboxed rerun passed all nine.

Advisory review found that native quarantine confirmation could label a different
file from the private Rust report subject. Native quarantine requests now fail
closed with native_subject_binding_unavailable until exact report-bound display
identity is implemented and reviewed. This is a mitigation, not completion of
quarantine UI acceptance. Retained scan cancellation now checks canonical
cancellationRequested and emits scan_cancelled rather than scan_completed.
The cancellation projection change still needs a dedicated retained-session
regression test; existing cancellation tests passed.

Remaining: exact native subject binding, shared inspection/action UI integration,
designated Engineer B review, contained browser download inspection and same-report
acceptance, reviewed main integration, offline/manual rehearsal and final release
pinning. No whole-scope completion or percentage is inferred from these checks.
