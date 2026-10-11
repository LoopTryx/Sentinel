# Owner-directed combined demo integration

Owner explicitly requested reviewing Engineer B, compiling the combined source,
pushing necessary changes to main and launching the console/extension setup.
Integration starts at main586908f and preserves both engineers' branches and chat.

Included source revisions:
- Engineer A scanner/native/runtime010b271 (cherry-picked owned series).
- Engineer B USB checker/dashboard265e9dc (PR62).
- Engineer B dormant USB gate/recoveryf249d53 (PR63).
- Engineer B extension presentationc5672e3 (PR65).

Independent source review of PR63 found no dormant-integration blocker: AV workspace
registration preserved, existing windows-sys0.61.2 reused, no app activation.
Combined456ec3e review found no blocker to the read-only demo: extension permissions
unchanged, local opt-ins retained, unavailable USB features disclosed, quarantine
disabled in both native host and screen. Two stale ClamAV UI descriptions were
corrected to Rust byte inspection before final UI tests/build.

Complete unchanged tools/verify.ps1 PASS (All available T01 checks passed).
Initial/retry linking failed from disk exhaustion; only task-generated AV debug
symbols and three explicitly named obsolete AV test executables were removed,
then the same full verifier passed. No source, peer work, packaged build or user
data cleanup. Native C# build and12 actual Rust/Node transport tests passed;
fresh WebView smoke passed with Console heading and demo_runtime backend.

Not protection/release acceptance: quarantine remains disabled pending recovery
beyond five-minute child expiry; USB policy remains dormant, no HID blocking or
HKLM activation. Bounds remain8MiB acquired/file and64 files. Browser downloaded
bytes, installed extension reload/pairing, native visual consent/offline rehearsal
and full milestone acceptance remain pending. Browser automation initialization
failed; Chrome extension management was opened but no installed reload or pairing
is claimed. CI waived by owner; tests were not weakened.
