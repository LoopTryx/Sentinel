# Windows worker resource boundary — issue #7

2 October 2026. `scan_file_via_worker` now creates the worker through native `CreateProcessW`, with a private Job Object assigned using `PROC_THREAD_ATTRIBUTE_JOB_LIST` during process creation. Job configuration and attribute installation must succeed; there is no unrestricted Windows fallback. Windows 10 or newer is required by this attribute.

The job permits one active process, caps committed process memory at 256 MiB, and terminates members when its last handle closes. Breakaway is not enabled. The inherited-handle list contains only a duplicated read-only source handle, stdout writer and NUL stderr writer. Parent stdout reader, job and process handles are not inherited. The executable is supplied explicitly, with one fixed argument and no shell. Process, thread, attribute list and pipe handles have ownership guards. A failed capture terminates the job, closes it as an independent kill-on-close path and waits at most one second; an unobserved exit returns `CleanupFailed` rather than claiming normal cleanup. Forced OS termination/wait failures have not been reproduced.

## Evidence

- The new resource test failed against the original launcher: the fixture could launch a child and exited with code 7, yielding `WorkerFailed` instead of the expected successful denial report.
- Both resource probes have unrestricted positive controls: child creation and a 512 MiB fallible allocation succeed without the new launcher. Under the launcher, both attempts fail and the fixture returns a valid benign report. No allocation contents are read or uploaded.
- A private inheritable event is signalled by the unrestricted probe, then reset. The constrained worker cannot signal that same parent event, proving exclusion of an unrelated inheritable handle rather than relying on handle-number equality.
- Nine worker-client tests pass: these probes, missing executable, approved file handoff, crash/invalid output, deadline cleanup, saturated/endless/oversized/duplicate output, valid large response and frame-without-exit timeout. Source temporary files are removable after return.
- `tools/verify.ps1` passed Rust formatting, clippy with warnings denied, workspace tests, generated binding parity, TypeScript checks/build and all 32 extension tests/build/parity smoke. Final log is locally retained under `.local-handoff/verify-worker-resources-final.log`.

The Cargo changes enable features on the existing windows-sys 0.61 dependency and add that existing package as a direct worker dependency for test-fixture Win32 probes. No new package or version is introduced. Shared manifest/lockfile scope is recorded on issue #7.

## Limits and next work

This is resource confinement, not a complete sandbox. The worker still has the current user's token and can open unrelated files or use the network. Restricted token/AppContainer, network and filesystem denial, CPU limits, hostile-input acceptance and signed executable identity remain gates before real untrusted scan jobs. The CLI still scans in process. No UI, E: access, malware file, Defender setting or device policy changed.

References: [Microsoft process attributes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute), [Microsoft Job Object limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information).
