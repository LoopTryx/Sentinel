# Owner-selected GLM pages — issue 11

Owner selects Scan File/Folder, Quarantine Vault UI and Watchtower UI as the final presentation direction. Branch codex/engineer-b/issue-11-glm-pages is stacked on PR68 at 1dc8a511240cabdfcdb111ba44b34342b3acaccb.

Recovered the preserved GLM upload-panel, vault and Scam Radar/Alert Centre structure. Existing scan handlers, validation, polling, canonical evidence, cancellation and quarantine gate remain unchanged. No native/runtime/generated/dependency changes. Quarantine storage/actions remain unavailable; synthetic Watchtower examples remain labeled. Existing automatic-remediation claims and unsupported drag/drop/path authority were not reintroduced.

Checks: UI typecheck/build passed. All three pages rendered at 1440 and 768px without horizontal document overflow. Restored desktop window launched and connected using tools/launch-demo.ps1; native startup evidence records backend=demo_runtime. No hardware or E: testing.

Current verification limits: UI test fork-worker startup timed out on two unchanged attempts; same suite with one worker passed: 10 files, 26 tests. Full verifier stopped at the existing sentinel-av scan_bounds directory budget test (48 MiB acquired versus expected 64 MiB); a focused standalone retry triggered a separate dependency rebuild and was stopped without a test result. Final results belong in the PR before review readiness. No assertions or deadlines weakened.

Reviewer Engineer A; coordinator integrates. These are actual production-source page replacements on the branch, not a separate mock page. Main is not yet integrated. Legacy dirty worktree preserved.

## Scan feedback and USB layout continuation — 2026-10-13

Owner screenshot requests implemented: shared ScanTargetPanel in Scan & Detect and USB Guard; CSS azure scanner ring and indeterminate bar only while the existing scan state is running, no invented percentage; selection controls remain disabled during a job and existing cancel controls remain available. Animation uses transform-only rotation/translation, pauses when the document is hidden and supplies a static reduced-motion state. No new dependencies or backend changes.

Threat Log presentation disclosure is now a real Show/Hide button with aria-expanded and aria-controls; examples stay labeled and separate from actual events. USB checker precedes Recent attacks. USB scan details use an engine/coverage definition grid, a red input-approval warning and individual file/hash cards with wrapping. The checker retains azure edges; red emphasizes the requested evidence/warning text.

Validation: full unchanged tools/verify.ps1 PASS (RUST_TEST_THREADS=1 to avoid concurrent native budget work), including all28 UI tests, Rust tests/lint/formatting, generated parity, builds and extension checks. Earlier focused UI run passed27 tests but failed to start the canonical scan test worker; its unchanged isolated retry passed and the complete verifier subsequently passed. No assertions or test deadlines changed.

Actual CUA browser verification: scenario button expands/collapses; USB checker precedes log; labeled temporary synthetic fixture shows loading and clears it after state changes; evidence renders in two columns and switches to one at600px without horizontal overflow. Synthetic fixture was removed and is not included in the build/commit. Reduced-motion media rule is implemented; OS preference toggling was not performed. Local screenshots scan-feedback-running.png and scan-feedback-details.png are synthetic render evidence, not real detection proof.

Refreshed actual desktop window confirmed native handle and backend=demo_runtime. Existing scan was checked idle before reopening. No USB/HID enforcement, hardware tests, real malware, E: access, native authority or remediation changes. Main integration remains coordinator-owned; Engineer A review requested.

## Supplied background replacement — 2026-10-13

Replaced the old OGL Dither implementation with the owner's supplied two-pass raw WebGL2 component. Wave evaluation uses the coarse pixel grid and a separate dither pass. App retains navy/azure and threat-state palettes. No dependency or runtime changes; Grainient hero remains separate.

Performance guards: default/app24 FPS cap (component clamps1–60), DPR1 with at most1.5 million drawing-buffer pixels, texture-size limit, low-power context preference, no app pointer/ripple effects, immediate hidden/offscreen cancellation, live reduced-motion updates. Cleanups delete GPU resources and listeners. Normal cleanup intentionally does not lose the shared canvas context: supplied loseContext cleanup broke React StrictMode's setup/cleanup/setup cycle, observed as a washed-out dev preview. The regression test now exercises StrictMode with context-loss-sensitive mocks.

Focused tests4 PASS and final UI production build/typecheck PASS. Earlier complete verifier PASS before the browser-discovered cleanup correction; final complete verifier is running. Browser actual shader rendering inspected after correction; temporary pixel/palette diagnostics removed. Screenshot D:/SENTINAL/replacement-dither.png. No GPU utilization or temperature benchmark on the owner's MX250 has been measured; no promised usage percentage. Native/release capabilities unchanged.
