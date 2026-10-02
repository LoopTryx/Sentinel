# Version-control consolidation evidence — 2 October 2026

Retained source heads: main e4d1766 (then live a2b63b2 peer message), GLM b84c4af63eff0ec618f3cbb4f602b66bb6be07f4, Codex 197516aee36bdc8d75ad87c6e6da5f72c105d7d5. Integration branch: codex/sentinel-unification-2026-10-02. Tests run on Windows in the owner-provided workspace. No E: access or device policy changes.

Observed checks on the combined implementation:

- tools/verify.ps1: exit 0; Rust formatting, Clippy, workspace tests/generated bindings, TypeScript typecheck/test/build, extension syntax, 32 extension tests, build and negative/parity smoke pass.
- powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File apps/desktop/tests/smoke.ps1: exit 0; native window handle/title and unavailable fixture coverage pass.
- powershell.exe -NoProfile -ExecutionPolicy Bypass -File apps/desktop/tests/jobs.ps1: exit 0; running/completed/failed/cancelled/timed-out/missing-executable, Windows argument quoting, actual selected harmless file/folder scans pass.
- Live GitHub PR #3 and #4 check-runs: both verify checks per PR completed successfully. Published peer reviews clear the stated fixture/preview scope. GLM's two P3 shutdown findings on #4 are tracked in LOGIC-02.

The initial sandboxed verification could not fetch missing pnpm dependencies; the authorized verification outside that network restriction passed. No test was weakened. Existing read-only preview limitations remain: fixture agent, unrestricted worker, partial scanner, no installed protection/USB gates, no vault/native host. Chrome manual block/allow/restart and full desktop accessibility/UI-close-path validation remain pending. Main's peer chat is preserved, including msg 10; fixture tests do not prove live protection.

The master-plan update changes assignment/theme/timing and clarifies user journeys; it does not implement the remaining product capabilities. GitHub plugin access still fails; restored Git/REST access is used. Credentials stay in the existing credential manager, not repository files or tool output.