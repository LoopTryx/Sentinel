# Native desktop scan jobs — preview evidence

Date: 2026-10-01. Owner: Codex. Issue: #1. Branch: codex/issue-1-desktop-ui.

## Implemented increment

- File and folder selection starts a separate sentinel-cli process, drained asynchronously over stdout/stderr. Dispatcher polling does not synchronously wait for a running process.
- UI shows elapsed time and indeterminate activity, keeps navigation available, disables duplicate starts, and exposes cancellation. No fabricated scan percentage is displayed.
- Cancellation kills this owned CLI process, discards its output and reports incomplete coverage. Timeout is 120 seconds; closing the window requests cancellation. A process observed complete before cancel retains its completed result.
- Nonzero exit, invalid JSON or an unexpected preview envelope cannot produce a completed UI report. Raw exception/stderr strings are withheld from the UI to avoid leaking selected paths.
- Completed reports still say partial coverage and show checked/skipped/access-error counts and inactive signature engine. Folder traversal completion is distinct from protection coverage.

## Executed checks

1. tests/jobs.ps1 first failed because the asynchronous job implementation was absent.
2. Implemented the helper; tests/jobs.ps1 passed process running/completion/failure/cancel/timeout and Windows argument quoting checks.
3. Expanded tests to missing executable and actual CLI file/folder scans on a temporary harmless text sample; all passed. Samples removed after checks. No EICAR file or E: data used.
4. tests/smoke.ps1 passed native WPF window-handle/title/unavailable coverage checks after the UI changes.
5. Full tools/verify.ps1 passed Rust formatting/lint/tests, generated-binding gate, TypeScript typecheck/tests/build and this branch's extension checks.

## Limits and next gate

This is a preview improvement, not Phase 1-70 completion. The WPF shell is interim; live authenticated agent IPC, durable jobs, numeric byte progress, detailed reports, restricted worker containment, all other feature areas and the final demo remain open. Process tests do not prove the file-dialog or complete keyboard/accessibility flows. UI cancellation is process termination, not cooperative persisted agent cancellation. Stdout/stderr are trusted CLI output buffered in memory; no general hostile-process output cap is provided here. No privileged policy, USB/HID mutation, remediation or provider request is enabled.
