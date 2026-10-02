# Windows worker output — issue #7

2 October 2026. This increment fixes the Windows host's exit-before-drain deadlock. It does not complete issue #7 or establish worker isolation.

The collector uses `PeekNamedPipe` on the owned stdout handle and reads only available bytes while checking the process and deadline. It reads the four-byte big-endian header before allowing payload growth, rejects declared payloads above 1 MiB, caps captured output to the message plus header, and rejects trailing frames. Success requires process success, pipe EOF, a valid frame/schema/report, and unchanged source metadata. A response alone cannot bypass the process deadline. Collection errors kill and reap the direct child. No background reader thread can remain waiting for a descendant's pipe handle.

The Cargo change enables `Win32_System_Pipes` on the already pinned windows-sys dependency; it adds no package/version change. This dependency feature and exact file scope are recorded on #7 for coordinator review. Non-Windows development retains the previous collector and is outside this Windows saturation acceptance.

## Actual evidence

- Before implementation, the new saturation process test failed: `TimedOut` instead of `InvalidResponse` after five seconds.
- After implementation, `cargo test -p sentinel-worker --test client`: six passed. Benign fixtures cover approved handle scan, crash/invalid output, hung worker, oversized/endless/saturated/duplicate output, valid 128 KiB padded response, and a valid frame from a process that refuses to exit. Deleting the selected temporary file after return checks release of the inherited source handle on Windows.
- `tools/verify.ps1`: passed Rust formatting/lint/workspace tests, generated binding parity, TypeScript typecheck/test, UI build, extension syntax, all 32 extension tests, build and parity smoke. The first sandboxed attempt could not download missing pnpm dependencies; the network-enabled rerun passed. A lint finding in the new test was corrected before the successful run.
- No native preview source changed, no E: access, no malware files, and no Defender/policy change.

Reproduce: run the client command above on Windows with the repository toolchain, then `tools/verify.ps1`. The failure-probe executable is test-only and must remain excluded from release packaging.

## Remaining gates

Restricted token/AppContainer, resource limits, inherited-handle allowlisting, network denial, descendant containment and kill-failure recovery remain open. Direct-process cleanup tests do not prove a Windows sandbox or containment of descendants. The CLI still scans in process; live authenticated durable jobs (#6) and integration into those jobs remain open. Desktop capped drains and bounded exception-safe shutdown are further #7 increments. Hardware enforcement stays gated on recoverable laboratory equipment.

## Unpublished desktop handoff

The primary checkout was inspected read-only and all four unpublished files were copied and SHA-256 checked before coding. The changes are report-envelope validation, its UI invocation, job-test invocation and new report tests; they are report/job work for #6/#9, not the shutdown fix. The primary checkout and deprecated branch remain intact. Transfer is tracked separately; retirement is not requested until useful work is reviewed and integrated.
