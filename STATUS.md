# Implementation status

Updated: 2026-10-01

The product, source packages, UI, extension, and private GitHub repository are named **Sentinel** at the owner's request. The original pasted PRD remains a historical source under its original filename. The renamed preview runs locally, but this naming change does not upgrade any protection capability.

## Owner's Phase 1-70 / Phase 1-30 split

The requested checkpoints and their evidence gates are recorded in [docs/phase-1-70-30.md](docs/phase-1-70-30.md). Phase 1-70 is a functional preview with the Y2K Cyber Console visual identity across the feature areas; Phase 1-30 closes privileged USB/HID enforcement, recovery, installer, security review, and release acceptance. These labels do not replace the master PRD's R1/R2 gates. The 70% demo has not been reached.

The first Chrome extension harness stage has a loadable Manifest V3 package, a synthetic-domain DNR block rule, and a popup that reports fixture-only coverage and no agent connection. The issue #2 stage (2026-09-30, `glm/issue-2-extension-harness`) makes that reporting runtime-verified: the popup reads the actual enabled-ruleset state via `declarativeNetRequest`, adds a block/allow toggle for the single reserved test domain, and shows fixture rule / native agent / scanning / coverage as distinct states with unavailable shown as unavailable. Status logic is unit-tested (32 tests) and a dist-parity smoke script plus a documented Chrome load checklist exist. See [extension harness evidence](docs/evidence/extension-harness.md). It has not yet been smoke-tested in Chrome by the owner and is not connected to a native host, so it is not a working Web Shield.

The first native Windows desktop preview is on issue #1. A WPF window has Overview, Files, Devices, Wi-Fi, Web, Vault, Messages, Learning, and Settings pages. Selected file and folder read-only CLI scans now run asynchronously with elapsed activity, cancel, timeout and incomplete-error states; other pages show unavailable or untested states. These local process jobs are not durable authenticated agent jobs. See [desktop scan evidence](docs/evidence/desktop-scan-jobs.md). The window does not imply an installed protection service. A native-handle smoke test passes. This is a first UI increment, not the Phase 1-70 checkpoint.

| Task | State | Evidence |
| --- | --- | --- |
| T00 Capability and threat-model dossier | In progress; policy/HID probes deferred | Read-only inventory confirmed an owned removable FAT32 `CRYPTIC` (E:) volume. No disposable Windows 11 machine or HID test device is available |
| T01 Contracts, jobs, functional shell | In progress | Rust contracts, generated TS bindings, shared CLI/UI fixture, CI, safe defaults, owner-bound in-memory jobs, and bounded RPC framing pass available checks. A fixture-only agent process answers one framed standard-input request. Authenticated live IPC remains open |
| T02 Privilege boundary and recovery | In progress | A file-backed lease journal and separate fixture recovery executable pass recovery tests. Separate fixture-only user and admin Windows named pipes verify the client's token SID/session after reading, reject remote clients, and pass DACL, method, elevation, and frame tests. No installed service, actual policy mutation, or scheduled recovery trigger exists yet |
| T03 Intel cache and provider controls | In progress | URLhaus-format fixture parser, offline exact-match cache, and local import/lookup CLI validate bounds, provenance, expiry, duplicates, corruption, and interrupted activation. Authenticated downloads, provider consent UI, signature policy, and performance gate remain open |
| T04 Restricted worker and scanner | In progress | Read-only single-file and bounded directory CLI previews report partial coverage. A separate worker process accepts only an inherited read-only file handle as stdin; host tests cover valid output, crash, malformed output, and timeout. The process has no restricted token, memory cap, or network denial. No full signature engine, archives, scan jobs, or quarantine |
| T05–T17 | Not started | No product implementation or verification evidence yet |

## Next T00 work

1. Confirm OS edition/build and Defender state with an authorized host inventory; the current shell denied CIM and Defender status queries.
2. Complete read-only host and dependency probes that do not change system policy.
3. Use `CRYPTIC` only for non-destructive storage observations and harmless scanner fixtures. When a disposable Windows 11 setup and owned HID device become available, run policy, pre-access storage, HID, recovery, and isolation probes there.
4. Record actual results, fallback decisions, dependency licenses, and a working pinned toolchain before closing T00.

No USB enforcement experiment should run on the daily-use machine during discovery.
Software contracts, fixtures, and UI states may proceed while hardware evidence is pending. The USB Gate remains disabled and R1 cannot be declared complete until its physical acceptance matrix passes.

## T02 checkpoint

`sentinel-recovery` records a lease and its prior value before a future mutation, syncs each journal event, and replays expired entries after restart. A restore callback must be idempotent because a crash can occur after restoration but before the completion event is durable. A separate executable restores a fixture file with the agent closed; it rejects target names outside the fixture directory. This has no OS policy adapter, access-control hardening, or scheduled recovery trigger, so it does not satisfy the T02 gate.
`sentinel-svc` now has a deny-by-default policy for a fixed RPC method enum. Separate fixture-only user and admin named pipes use an explicit logon-session SID DACL and `PIPE_REJECT_REMOTE_CLIENTS`, then impersonate the client after reading the frame and obtain SID/session/elevation from the thread token. Local tests passed for valid fixture capabilities, forged identity fields, admin-method denial, admin elevation gating, oversized frames, and denial of a second same-user server instance. This is not an installed service; it has no read timeout, rate limiter, or policy adapter. See [IPC evidence](docs/evidence/ipc-boundary.md).

## T03 checkpoint

The `sentinel-intel` crate parses a URLhaus-format fixture with strict URL and size limits, then activates a disk snapshot only after validation. On offline startup it selects a valid snapshot and reports `listed`, `not listed`, `stale`, or `unavailable` without calling an unlisted URL safe. A digest detects accidental cache corruption; it is not a provider signature. Provider network access remains disabled by default and no API key is stored. See [provider registry](docs/evidence/provider-registry.md).

## T04 checkpoint

`sentinel-scan` opens user-selected regular files read-only, streams SHA-256 with a 512 MiB per-file cap, and detects the EICAR test string across read chunks when readable. On Windows, the file handle uses `FILE_FLAG_OPEN_REPARSE_POINT` and the opened handle's attributes are checked so a final-component link swap is skipped. The CLI exposes `sentinel-cli scan file <path>` and `sentinel-cli scan directory <path>` with `local_read_only_preview` mode and `partial` coverage. Directory traversal has entry, depth, pending-directory, and finding caps; skips discovered symlinks and Windows reparse points; and supports cancellation between read chunks through the library API. Missing, unsupported, changed, cancelled, and size-limited files are never counted as checked. A local Defender race removed one EICAR fixture before opening it; the report recorded an access error rather than a completed check. Routine tests now use an in-memory EICAR stream to avoid further Defender alerts. `sentinel-worker` runs the same bounded byte scan in a separate process receiving only an inherited file handle, with protocol output validation and a host timeout. It is not yet a restricted worker; the CLI still uses the in-process path. The full signature engine is inactive. Concurrent ancestor-path replacement, restricted token, memory cap, network denial, archives, YARA-X, ClamAV, durable scan jobs, live CLI cancellation, progress UI, and quarantine remain open. Do not use a clean preview result to release USB storage. See [worker boundary](docs/evidence/worker-boundary.md).

## T01 checkpoint

Rust 1.98.1 GNU toolchain and MinGW 16.2.0 were installed because the MSVC linker was absent. The first contract and CLI/UI tests were observed failing before implementation and then passing after implementation. The shared fixture is explicitly labeled as a preview. No installed service or USB enforcement exists yet.
The `sentinel-core` default disables provider requests and USB policy changes. `sentinel-agent` now enforces job ownership and terminal-state transitions in memory; no privileged pipe or persisted job exists yet.
The agent's `--fixture-stdio` mode accepts only a versioned `status_fixture` request and returns the same typed status fixture used by the CLI and UI. Process-level tests cover its exact output, protocol mismatch, malformed/truncated requests, and the 1 MiB limit. It is a development endpoint, not a protection service.
The first Windows CI runs passed tests and build but the generated-binding check falsely flagged rewritten files because it used `git status`; a fresh CRLF checkout reproduced status changes with no content diff. The verifier now checks actual diffs and untracked outputs. Windows CI run 4 completed successfully on commit `b7010e9`.

## 2026-10-02 consolidation checkpoint

Local integration retains GLM b84c4af extension work and Codex 197516a asynchronous desktop preview, with both status reports and main's peer chat history preserved. Full tools/verify.ps1 passed for the extension merge; native window smoke and scan-job process checks passed for the combined tree. Final combined verification is recorded in docs/evidence/version-control-consolidation.md. No live protection capability is upgraded by these merges.

The owner-aligned master plan now assigns GLM to Y2K Cyber Console presentation and Codex to logic. Specialized prompts and an eleven-item issue draft queue are under docs/agent-prompts/ and docs/coordination/. Authenticated Git/REST access was restored by the owner; the GitHub plugin remains unable to see Sentinel. Eleven work issues #5–#15 are published. Live PR #3/#4 CI and peer reviews were inspected, including GLM msg 10. Integration publication, main merge and recoverable branch retirement are recorded in the consolidation PR and dated coordination record. Phase 1-70 and R1/R2 remain incomplete.

Final integration: PR #16 is merged into main; #3/#4 are marked merged. Three obsolete branches were archived and retired. The old Codex branch is deprecated but preserved pending transfer of unpublished work from the engineer's existing checkout (#1/#6/#7). main is the one authoritative baseline. Next ready assignments: Codex #6/#7 and GLM #10, with #8 contract specification reviewed before browser wiring.

## 2026-10-03: Actual selected-directory progress leaf
Issue #9: scan_directory_with_progress emits typed cumulative entry/file/read/error counters, initial/final snapshots and cancellation/limit/traversal flags. Five progress tests failed first and now pass; decimal JSON assertion failed first and now passes; six new behavior/contract tests plus existing pipeline checks and full verifier pass. Generated TS uses exact decimal strings. See docs/handoffs/scan-progress.md and docs/evidence/scan-progress.md. Library only: no GUI/native dispatch, single-file/chunk observer, parent timeout or live capability added. Next: reviewed scan job/local adapter integration and GLM wiring; actual event acceptance remains pending.

## 2026-10-03: Selected-file cancellation API follow-up
PR #36 now exposes scan_file_with_cancel and checks cancellation before metadata/open. Initial cancel/invalid-path regression failed first and passes; actual harmless mid-read cancellation/retry control preserves partial bytes without checked/hash claims. Two additional tests and full verifier pass. No native/CLI cancellation endpoint, single-file progress or timeout adapter activated. Typed report conversion and reviewed job/GUI wiring remain next, along with S1 integration/rehearsals. Original dirty primary checkout preserved.

### S1 selected-file typed output — 2026-10-03, issue #9 / PR #36

Generated SelectedFileReport and actual scanner conversion preserve partial coverage, outcome, hash/absence and precise counters, plus bounded opaque job/selection correlation. Four benign/mapping/bound tests pass; native selection authorization, response matching, timeout/transport adapter, directory report conversion, reviewed integration and GLM UI journeys remain open. See scan-progress handoff/evidence. This is a library contract increment, not a connected scan capability or event-ready declaration.

### S1 directory typed output — 2026-10-03, issue #9 / PR #36

SelectedDirectoryReport conversion preserves actual final counters/flags and partial engine coverage, with bounded path-free finding references and explicit omitted count. Two new tests cover real benign success/cancel/skips/entry limit/missing root plus synthetic conversion bounds. Native selection/job authority, deadline/stale-result adapter and GLM UI wiring remain pending. See scan-progress handoff/evidence. No event acceptance or installed protection claimed.
