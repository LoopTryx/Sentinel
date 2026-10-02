# Sentinel consolidation and issue queue — 2 October 2026

Owner decision: one authoritative main; GLM owns UI and Codex owns logic. The coordinator integrates reviewed work, maintains the plan, and publishes concrete issues. Initial access was unavailable. The owner restored repository-scoped Credential Manager; authenticated fetch and GitHub REST access now work. The GitHub plugin still returns 404 for Sentinel, so the coordinator uses the restored Git credential for Git/REST without logging or saving the credential. Live branches match the retained engineer heads; main advanced to a2b63b2 with GLM peer-review msg 10. Both PR #3 and #4 have successful CI checks and published cross-peer review. Published issue numbers are recorded below and in published-issues-2026-10-02.json.

## Retained code and branch disposition

| Cached branch / tip | Decision | Evidence and limitation |
| --- | --- | --- |
| main / e4d1766 | Preserve as integration base | Includes Rust contracts, bounded scanner, fixture IPC/recovery/intel and all nine peer chat entries |
| glm/issue-2-extension-harness / b84c4af | Retain extension changes through merge | Actual Chrome API status queries, serialized rule toggles, best-effort diagnostics, exactly-once responses, 32 runtime/state/parity tests; only synthetic-domain harness |
| codex/issue-1-desktop-ui / 197516a | Retain native asynchronous scan preview through merge | WPF native handle and file/folder job tests pass; no durable authenticated jobs or worker isolation |
| codex/t01-contracts / edc9625 | Obsolete baseline; no independent code to select | Ancestor of main; historical requirements stay in history |
| local glm branch / 0d77957 | Stale checkout; do not treat as latest GLM work | Six commits behind the cached remote GLM ref; not edited |

The native preview and React fixture shell are complementary development artifacts, not two production applications. Production direction remains Rust + Tauri 2 + React. No glassy GLM desktop UI was found in these cached refs. No UI code was discarded on that assumption.

Integration branch: codex/sentinel-unification-2026-10-02. Merge history preserves both contributors. The only code changes are their existing increments; planning changes are separate. Resolve STATUS.md by retaining both capability reports; preserve main's entire chat.md. Do not import stale branch copies of the collaboration rules over main.

After access returns: fetch again, inventory every current branch/open issue/PR and review comments, compare the exact changed heads to these retained tips, rebase no contributor branch, incorporate newly published work on the integration branch, run verification, publish/update the integration PR, and merge when CI and review gates pass. If #3/#4 remain open and their heads are integrated, mark the integration relationship explicitly rather than pretending they were merged individually. Never close a feature issue merely because a preview was retained.

Retire obsolete branches only after main contains their entire useful history and no active contributor work/open PR depends on them. Preserve a recoverable archive tag at each final head, verify the tag on GitHub, notify each engineer through chat.md and the issue, then delete the obsolete remote branch without force-pushing main. Do not delete a branch with unseen or unmerged work. main remains the existing default; “singular master” means one source of truth, not an unnecessary rename that breaks references. Short-lived issue branches remain necessary for the two engineers' review workflow; old long-running plans/branches are deprecated.

## Draft issue bodies to publish after inspecting existing issues

Each entry has a stable draft key, not an invented GitHub number. Check for an existing issue before creating one; link these acceptance criteria there if it already tracks the same work. The priority describes scheduling, not an independently verified severity rating.

### VC-01 — P1: Align plan, assignments, and integration baseline

Owner: coordinator. Files: AGENTS.md, docs/AI-COLLABORATION.md, master plan, phase split, STATUS.md, prompts and this record. Problem: old prompt assigns Codex to UI and GLM to extension logic; presentation plan defers an older purple Aurora Glass theme despite the owner's current Y2K Cyber Console request. Outcome: one authoritative plan, GLM UI/Codex logic, preserved contributor history, published queue and retirement record. Acceptance: no conflicting active role instructions, current heads/PR checks reviewed, full verifier and desktop checks green, peer messages intact, archive refs verified before branch removal. Documentation and issue queue are prepared; final main adoption is recorded by the consolidation PR.

### LOGIC-01 — P1: Authenticated live agent and durable owned scan jobs

Owner: Codex. Depends on contract decisions. Files: sentinel-agent, sentinel-proto, sentinel-svc user-session boundary, CLI; GLM consumes adapter separately. Evidence: sentinel-agent/src/main.rs accepts only --fixture-stdio; current jobs are in memory; apps/ui imports a status fixture. Acceptance: actual SID/session authorization, rejection of remote/forged/cross-user requests, bounded request/read/concurrency, persisted job lifecycle/report retrieval, real cancellation/progress and restart/disconnect tests, explicit missing-agent state. No live protection claim until proven. First core implementation priority.

### LOGIC-02 — P1: Restricted workers and bounded concurrent output handling

Owner: Codex. Files: sentinel-worker, sentinel-scan/src/worker.rs, relevant CLI/job dispatch. Evidence: worker launch uses ordinary Command::spawn; parent waits for exit before draining stdout, so enough output can fill the pipe and end in timeout rather than a prompt protocol rejection. Desktop ReadToEndAsync drains concurrently but has no byte cap. Acceptance: approved read-only handles, verified restricted token/AppContainer or documented supported containment, network denial, resource/handle/output limits, drain while running, kill-and-reap on breach, saturation/endless-output/crash tests, live job dispatch through this worker. Sandbox labels require Windows containment evidence. No policy tests on the owner's daily machine.

### LOGIC-03 — P1: Complete and approve native-host contract, then bridge

Owner: Codex for codecs/host/runtime; GLM reviews rendering/examples. Files: sentinel-proto, planned sentinel-native-host, extension background/bridge, contract proposal. Evidence: draft has schemaVersion:1 while discussing minor versions, lacks numeric pending-map/ID bounds, and calls arbitrary header bytes “non-ASCII length fields.” Native length headers are binary; test decoded length and multibyte UTF-8 payload byte counts. Acceptance: explicit major/minor representation compatible with existing protocol; full valid Assessment examples; fixed limits (proposed ID <=128 UTF-8 bytes, <=32 pending requests, URL <=2048 characters plus byte/message caps); separate Windows Chrome little-endian/internal big-endian codecs; exact caller origins and authenticated agent connection; timeout/duplicate/late/disconnect tests; capabilities.list/url.assess only; no URL fetch; redacted diagnostics. Manifest permission changes occur with reviewed implementation. No host registration or live connectivity claimed from mocks.

### LOGIC-04 — P1: Quick/full scans, evidence, inspector, and quarantine

Owner: Codex logic, GLM views in separate issue. Depends on LOGIC-01/02. Evidence: bounded hash/EICAR preview is partial, full signature engine inactive, no archive/transactional quarantine. Acceptance: explicit scan-profile scopes/exclusions, bounded archives/signature engines and engine freshness, skipped/errors/limits, report identity, detailed finding evidence, cancellation, stable-identity authorized remediation, journal/recovery/restore failure tests. EICAR stream tests remain in memory; do not trigger Defender repeatedly. Full scan does not imply complete threat detection.

### UI-01 — P1: Y2K tokens, threat-state shell, dashboard, awareness dialog

Owner: GLM. Files: apps/ui styles/components/i18n/views and UI tests. Evidence: current React application is one fixture status page, no notifications/awareness flow, no production desktop bridge. Acceptance: deep navy/azure #2f89e3/chrome/CRT identity, readable translucent shell and opaque reports, generated DTO rendering with separate risk/coverage/freshness/mode, clearly labeled fixtures, all unavailable/stale/failure states, notification-to-evidence dialog, accessible focus and reduced motion/transparency. No invented green protection. Can proceed alongside LOGIC-01/02; real adapter integration follows their delivery.

### UI-02 — P1: Scan/report and extension presentation using shared contracts

Owner: GLM. Depends on UI-01 and LOGIC-01/03/04 for real actions. Files: React scan/inspector/activity views; extension popup/block-page/banner presentation only. Acceptance: scope-aware quick/full choices, genuine progress/cancel, safe disabled states for unavailable actions, detailed checked/skipped/errors, subject-bound awareness, native-host absent state, keyboard/reflow tests, Chrome manual evidence clearly separated from fixtures. Coordinate mixed extension files before edits; Codex owns authority/background logic.

### LOGIC-05 — P2: Passive Wi-Fi/USB/hygiene reports and bounded monitoring

Owner: Codex; GLM builds reports after DTO agreement. Files: planned wifi/usb/hygiene crates, agent events, watcher. Acceptance: consent-scoped passive observations, timestamps/baselines/per-check reasons, read-only inventory, supported/unsupported states, bounded watch queues, advisory findings without automatic heuristic process killing, network/permission/portal/VPN/offline tests. UI warning explains evidence without asserting interception. USB/HID enforcement is separately gated under RELEASE-01.

### LOGIC-06 — P2: One reviewed encrypted vault, imports, autofill, audit

Owner: Codex backend/extension authority; GLM locked/unlock/audit/generator UI. Depends on authenticated boundaries. Files: planned vault process/crate, contracts, origin/gesture-bound bridge. Acceptance: reviewed KDF/authenticated encryption/key isolation, master-password unlock/auto-lock, backup/recovery, one-record explicit fill, selected supported export import, local reuse/common-pattern checks, optional provider-consented breach query, no raw secrets in logs/AI/diagnostics, synthetic tests for tampering/wrong password/corrupt backup/origin and gesture failure. Valuable credentials are blocked pending security review. Password estimates display model assumptions; password changes require user action on the official site.

### LOGIC-07 — P2: Browser links/downloads/messages and private awareness assistant

Owner: Codex decisions/adapters/privacy, GLM explainers and academy. Depends on bridge and scanner. Acceptance: opt-in mail and WhatsApp Web adapters, local analysis, narrow sender/tab/frame permissions, source URL checks separate from staged downloaded-byte checks, absent-host/paused/unsupported states, bounded redacted unified events, 25 lessons by R2, assistant uses allowlisted non-secret assessment summaries, no autonomous actions or upload of raw messages/files/passwords. Local assistant unavailable state until an actual supported runtime is integrated. Live-site claims require separate manual validation.

### RELEASE-01 — P1 release gate: Recoverable USB controls, lifecycle, security closure

Owner: Codex controls, coordinator gates, GLM recovery presentation. Depends on recovery, worker, scanner, independent lab access. Acceptance: full master-plan storage/HID/composite/reconnect/reboot/spoofing/recovery matrix on declared owned Windows equipment, independent recovery, measured exposure windows, separate storage/HID approvals, installer/uninstaller owned-policy rollback, signed update validation, privacy/vault review, performance and accessibility gates. This cannot run on the daily-use machine or CRYPTIC (E:). Missing lab blocks R1 protection claims, not independent UI/software work.

## Coordinator operation

Publish ready issues with outcome, dependencies, file boundaries, tests, and evidence limits; maintain a dependency queue. Review current code and cross-peer findings, run exact integration checks, and keep open problems visible. Use GitHub issues/PRs as the durable record; chat.md is append-only coordination. Never alter a contributor's active branch or force-push. Get concrete peer review before merge where available; record unavailable review as a blocker rather than treating the coordinator's own tests as peer approval. The owner has authorized routine issues, commits, pushes, PRs, and consolidation; ask only for actual unavailable prerequisites or consequential decisions outside that scope.

## Published issue mapping

- VC-01: [#5](https://github.com/LoopTryx/Sentinel/issues/5) — [VC-01] P1: Align plan, assignments, and integration baseline
- LOGIC-01: [#6](https://github.com/LoopTryx/Sentinel/issues/6) — [LOGIC-01] P1: Authenticated live agent and durable owned scan jobs
- LOGIC-02: [#7](https://github.com/LoopTryx/Sentinel/issues/7) — [LOGIC-02] P1: Restricted workers and bounded concurrent output handling
- LOGIC-03: [#8](https://github.com/LoopTryx/Sentinel/issues/8) — [LOGIC-03] P1: Complete and approve native-host contract, then bridge
- LOGIC-04: [#9](https://github.com/LoopTryx/Sentinel/issues/9) — [LOGIC-04] P1: Quick/full scans, evidence, inspector, and quarantine
- UI-01: [#10](https://github.com/LoopTryx/Sentinel/issues/10) — [UI-01] P1: Y2K tokens, threat-state shell, dashboard, awareness dialog
- UI-02: [#11](https://github.com/LoopTryx/Sentinel/issues/11) — [UI-02] P1: Scan/report and extension presentation using shared contracts
- LOGIC-05: [#12](https://github.com/LoopTryx/Sentinel/issues/12) — [LOGIC-05] P2: Passive Wi-Fi/USB/hygiene reports and bounded monitoring
- LOGIC-06: [#13](https://github.com/LoopTryx/Sentinel/issues/13) — [LOGIC-06] P2: One reviewed encrypted vault, imports, autofill, audit
- LOGIC-07: [#14](https://github.com/LoopTryx/Sentinel/issues/14) — [LOGIC-07] P2: Browser links/downloads/messages and private awareness assistant
- RELEASE-01: [#15](https://github.com/LoopTryx/Sentinel/issues/15) — [RELEASE-01] P1 release gate: Recoverable USB controls, lifecycle, security closure
