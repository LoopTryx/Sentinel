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

## 17 October 2026 — backend and production bridge qualification

Latest PR head fetched and preserved: 55a61dc8f30b00832c7387bf2ec3db3ccad2a4fa, including Engineer B3637eb2 already integrated. No B branch edited; unrelated audio work and NativeConsole remain separate.

Actual elevated diagnostics: explicit SYSTEM-owned job creation returns Win32 1307 (ERROR_INVALID_OWNER); default trusted owner succeeds for unnamed, named Local and named Global jobs. Required named producer job, protected DACL, suspended launch, containment and cleanup retained. Native error now captured immediately before LocalFree. Historical named-stage2 failure does not reproduce on current default-owner source; do not claim a newly established distinct named-object cause.

Historical baseline COM failure also does not reproduce. Independent read-only baseline check passed repeatedly. Added precise GPO OpenLocalMachineGPO/GetRegistryKey and scheduler call context, HRESULT and nested diagnostics. No unsupported claim that STA caused the historical failure. Concrete newly reproduced blocker: recovery polling reopened the protected decision lock while the SYSTEM writer held it (IOException 0x80070020). Fixed read-only running-task authentication; protected-state verification happens after completion. Read verification now follows Decision -> legacy baseline -> GPO lock order, matching writes.

Concrete live-overlay defect fixed: retained legacy deny switches were stripped from actual managed policy but remained in expected images. Both comparison sides now normalize consistently; saved legacy switches and foreign values remain preserved. Disposable HKCU overlay regression PASS.

Full private backend qualification PASS (actual protected worker and real SYSTEM task, synthetic private policy location): multi-block/apply/Allow-one, precommit restoration retaining earlier committed block, postcommit candidate preservation after lost reply, and task/pending cleanup. This is not physical USB or Windows-restart evidence.

Production bridge implemented behind explicit -ReviewedExact build: fresh native session reference -> exact selection -> named native confirmation -> Windows Hello -> protected worker/recovery -> saved/effective policy readback -> durable commit. Original baseline binding required; old journal/proposals/tasks/producers must be absent, old controller/config exclusion leases retained. No class-wide apply enabled. Recovery-only startup, disconnected committed Allow and truthful persistent-policy status included. Installation alone is not proof of hardware behavior.

Commands/outcomes:
- ./tools/build-usb-admission-operator.ps1 -ReviewedExact: PASS compiled operator and separate live worker; old shared class live path remains disabled.
- ./tools/usb/tests/test-usb-exact-block-state.ps1: PASS.
- ./tools/usb/tests/test-usb-exact-block-transaction.ps1: PASS 344 modeled cases.
- ./tools/usb/tests/test-usb-exact-block-selection.ps1: PASS 36 assertions, synthetic only.
- ./tools/usb/tests/test-usb-exact-block-native-authority.ps1: PASS, no Hello/device claim.
- ./tools/usb/tests/test-usb-exact-block-recovery-tasks.ps1: PASS contract checks.
- ./tools/usb/tests/test-usb-exact-block-overlay.ps1: PASS disposable HKCU, no machine enforcement.
- pnpm --filter @sentinel/ui exec vitest run src/features/usb/tab-contract.test.ts src/features/usb/UsbGuardView.test.tsx: PASS 6 tests.
- pnpm --filter @sentinel/ui typecheck: PASS.
- ./tools/verify.ps1 unchanged: PASS exit0, artifacts/usb-final-full-verifier.log. Later disconnected-release/native-label changes received affected native and UI checks.
- owner-approved Run-UsbBlockDiagnostics.ps1: baseline PASS exit0; full private backend PASS exit0; artifacts/usb-block-{baseline,backend}-diagnostic.log.
- owner-approved Install-UsbExactReviewedTrial.ps1: protected immutable live runtime/operator installed; read-only production bridge PASS exit0, artifacts/usb-production-read-qualification.log. No device restrictions applied by installation.

Hardware acceptance PENDING. Owner selected RP2040 harmless QUACK typing. Need physical Block/reconnect with normal controls intact, Allow/reconnect, second approved test device + Allow-one, closure, actual restart persistence and release. No automatic reboot. Block post-apply fresh inventory may fail closed and roll back if Windows removes the selected function from enumeration; physical evidence must determine this. Console replacement is waiting for the owner to Exit the tray app because its executable remains locked. Do not claim completion or merge PR74.

## Physical trial follow-up — empty-list validation defect and verified recovery

Owner reported RP2040 did not type before the test, Allow did not revive it, and optical-mouse Block returned Access not verified. Therefore no physical Block success is claimed. Do not use ordinary controls for further trials; establish working RP2040 typing baseline first.

Owner-approved Read-UsbExactAfterTrial found an interrupted transaction. The diagnostic recovery found committed=False, blocks=0, pending RecoveryClaimed/action block/one target, before decision retained. Both policy validation and recovery initially failed ValidateLegacyChildren: Legacy deny list missing. This is distinct from the earlier historical COM exception.

Reproduced with a disposable HKCU baseline: remove only the empty DenyInstanceIDs subkey while retaining authenticated root flags/marker and neutral siblings. Regression failed with the same error, then passed after recognizing absence as an empty list. Nonempty committed images must still match exactly; missing real entries, foreign values, unknown children and malformed IDs still refuse. Initial exact verification uses the authenticated exact provider rather than the older baseline check that required that empty subkey; no baseline recapture.

Owner-approved corrected recovery PASS exit0: RECOVERY verified, production baseline/saved/effective readback PASS, no committed block. Logged artifacts/usb-after-trial-recovery-corrected.log. Corrected runtime installed through explicit -UpgradeReleasedRuntime: decision lock, no pending/no committed blocks, no registered/running exact recovery tasks or old worker processes, protected old manifest/image authenticated, new immutable hash image and atomic manifest replacement preserving scope/backup. No device-policy changes or restarts in installer. Post-install readback PASS: committed=False blocks=0 pending=False, artifacts/usb-production-corrected-read.log.

Affected tests PASS: missing-empty-list HKCU regression (red then green), policy image/state tests, 344 modeled transaction faults, 36 selection assertions, native authority test, reviewed exact worker/operator/production-read builds. Full verifier previous PASS retained; no unrelated source change or broad rerun. Production recovery and empty-state runtime upgrade actually executed under owner-approved Windows prompts. Physical success, Allow input restoration and restart persistence remain PENDING.
