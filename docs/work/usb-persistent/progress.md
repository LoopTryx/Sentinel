# Progress

Inspected current diff, PR74 remains open/draft stacked branch; current fetch requires Git metadata escalation. Read source policy/journal/worker and Microsoft device-installation documentation. Selected architecture: committed exact-device blocks persist, pending transition has independent rollback; no new live policy has been enabled. Current ordinary inputs remain working after owner reboot.


## 17 October 2026 — private legacy overlay qualification

Owner-approved native `Run-ExactBlockPrivateQualification.ps1` completed successfully. Actual protected file state survives a fresh process; claim/commit fencing preserves committed state. Actual saved/effective private local Group Policy apply and final-entry cleanup pass. A simulated legacy baseline at the private key survives Block A, Block B, Allow A (B retained), and Allow B (original baseline retained). No DeviceInstall policy or physical device was changed; no restart trial or independent SYSTEM recovery claim.

`test-usb-exact-block-state.ps1`, `test-usb-exact-block-transaction.ps1` (344 modeled fault cases), and `test-usb-exact-block-gpo.ps1` pass. New authenticated legacy overlay hook independently reviewed with no concrete blocker; its separate HKCU tests do not establish authenticated live qualification. Private provider legacy mode independently reviewed with no concrete blocker.

Next: qualify actual private adapter Save/refresh/rollback under the durable writer fence; implement independent authenticated transition recovery and production baseline authority, then bind existing Hello-protected actions. Installed containment remains unchanged. Live selected-device Block/Allow and actual restart persistence remain required.


## Publication checkpoint — 17 October 2026

Manual native private adapter qualification passed all four reported stages, including actual writer-fenced Save/refresh/readback, preserving B on Allow A, precommit restoration and late-commit refusal, and final empty baseline. Independent recovery methods still deliberately refuse. Scheduler draft compiles and pure contract tests pass; no task registered, no SYSTEM/boot claim. Fixed working-directory validation and authenticated self-retirement remain open before use. Native exact authority scope/binding tests pass and independent review found no concrete bypass; real integrated Hello is still pending.

Source is being published through PR74 with continuation instructions in `docs/usb-progress-handoff-2026-10-17.md`. B branch ee04077 and unrelated NativeConsole preserved. Fresh USB/native/UI checks pass. Full verifier native retry fails sentinel-av workspace-test compilation with missing compiled crates/rlibs; no cause or full pass claimed. No installed update or live policy change during publication.


## Owner-directed integration checkpoint — 17 October 2026

Owner requests prioritizing combination with Engineer B3637eb2, compiling all and publication. Full unchanged tools/verify.ps1 PASS at artifacts/usb-finish-pr74-verify.log; antivirus no-run compile succeeded with same isolated target and no AV source change. Actual authenticated live baseline read-only qualification PASS after preserving known empty neutral siblings in saved/effective views. No DeviceInstall change.

Actual private SYSTEM fixture PASS: independent scheduled recovery restored uncommitted private policy; external controller verified and retired task/journal. New full backend sources compile with pinned manifest, suspended authenticated named-job producers and separate SYSTEM recovery self-job. Full backend private run has NOT passed: stage2 failed creating SYSTEM-owned parent job. Actual elevated unnamed-job probe proved explicitSYSTEM ownership error1307, default administrator ownership succeeds. Source fixed to default ownership with unchanged protected SY/BA DACL and trusted-owner validation; corrected controller built using immutable existing worker. Corrected private full backend not rerun yet. Its protected private journal/recovery state is retained; no hardware restrictions were installed. Do not represent the worker candidate as activated production Block/Allow.

Next enforcement work remains connected operator authority/worker/live exact provider qualification and physical Block/Allow/restart acceptance. The integration checkpoint retains containment gate and source/test/handoff work, and preserves Engineer B commit history.
