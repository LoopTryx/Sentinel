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

## Physical evidence and sign-in startup checkpoint

Owner confirms working RP2040 QUACK after restarting Windows, followed by QUACK not running after Block/reconnect: one owner-observed physical Block success. RP2040 Allow and actual restart persistence remain unverified. Owner separately tested external keyboard (continued typing) and optical mouse (brief interruption then normal input). Read-only native diagnostic verified one committed policy, no pending transaction, matching saved/effective policy, target USB Optical Mouse with started=True, problem=0, need_restart=False. Therefore general input blocking is FAILED, despite retained exact policy. Owner later confirmed mouse Allow cleared its rule. Do not treat a repeated Block no-op or a brief interruption as protection.

Status follow-up distinguishes policy_only (saved rule, input blocking unconfirmed) from Windows-reported device stopped; disconnected committed entries also avoid a physical stoppage claim. Already-blocked rows disable repeated Block. Focused USB contract/UI tests PASS 7; UI typecheck/build PASS; reviewed exact worker/operator build PASS. These status changes are source/built, not a claim of installed physical acceptance.

Added tools/configure-desktop-startup.ps1. Executed for the current installation: verified current-user Startup/Sentinel.lnk points to the canonical physical Sentinel.exe, opens normal app at sign-in without elevated startup authority; Disable reverses only the matching entry. Actual next-sign-in launch remains unobserved. No USB policy change/reboot performed. Short owner-facing brief: docs/SENTINEL-STATUS-2026-10-17.md.

Owner requests default-deny for all external USB inputs until Hello-authorized Allow, preserving built-in keyboard/trackpad exclusions. Not enabled: keyboard/mouse enforcement and release/restart acceptance remain prerequisites. Current evidence demonstrates exact installation-policy persistence, not a verified universal input gate.

## 18 October default-deny continuation

Owner's attached plan supersedes exact-deny-only design. Four read-only external HID function trees mapped, two DN_DISABLEABLE false. Built-in keyboard Recovery and both built-ins normal Windows explicitly owner-confirmed. No new live class rule or SetupAPI transition enabled.

New source (currently uncommitted) includes canonical admission codec, reused namespaced transaction/store kernel, scoped GPO provider, protected PnP journal, SetupAPI adapter, committed-disable receipt validator, count-only Raw Input probe, and private actual worker/SYSTEM qualification build. See docs/evidence/usb-guard-acceptance.md. Full verifier PASS exit0. Pure/native parser and modeled tests passed; protected journal actual UAC PASS21. PnP parent-commit lost-reply gap fixed with required authenticated parent-decision resolver; 198 modeled tests PASS. No constant resolver permitted in production.

Actual new private backend qualification FAIL stage2 at worker Launch. Detailed authenticated recovery narrowed it to gpupdate exceeding35000ms, TimeoutException0x80131505 in Refresh, retaining RecoveryClaimed private journal. Independent owner-approved refresh diagnostic now running outside Sentinel locks, bounded90000ms; artifacts/usb-hid-independent-refresh.log and local-only raw output. Do not replace installed private worker or discard interrupted state. Build retry uses -UseExistingWorker so hash remains pinned. This private location cannot restrict actual USBs.

Next: inspect independent refresh duration/exit; reproduce cause, fix bounded refresh without bypassing saved/effective readback; recover private pending with existing worker then pass actual private activation/AllowA/B/BlockA and SYSTEM rollback/preservation. Before production connect durable parent history/receipts and PnP journal under same decision fence; handle authenticated prune/reappearance; distinguish policy-only Allow; do not claim skipped non-disableable functions blocked. Activation remains disabled, hardware/restart acceptance PENDING. Preserve Engineer B and unrelated ui-sounds/WAV/NativeConsole. No new commit/push yet.

### Native qualification follow-up

Independent gpupdate outside Sentinel locks also failed: exit -1, elapsed35205ms, reported computer-policy update had not completed in expected time. Elevated GroupPolicy Operational events showed Registry CSE completed328ms and event8004 successful manual processing in0sec. Therefore the old synchronous gpupdate completion wait is not a reliable completion signal here; do not claim Group Policy itself failed to apply. New private path requests /wait:0 and independently polls recognizable saved/effective candidate/before images under the writer fence; foreign drift still refuses and convergence is bounded30sec. Original private fixture authenticated rollback PASS exit0 with no activation, artifacts/usb-hid-private-fenced-recovery.log.

Fresh version2 private fixture preserves original recovered fixture and its immutable image. Actual activation progressed, then scheduler enumeration raced a disappearing running-task COM object: HRESULT0x8004130B, Retire. Narrow fix catches only that vanished-instance code during running-item Path inspection; fresh authenticated task/state recheck remains mandatory. Other COM errors propagate. Focused recovery-task contracts pass. Retried qualification recovered interrupted Committed state and actual namedworker activate/AllowA/AllowB/BlockA-preservesB now PASS. Actual SYSTEM rollback/preservation and final cleanup still running; artifacts/usb-hid-private-v2-retirement-fixed.log.

Second unchanged full verifier under sandbox failed13 retained-file AV tests with AccessDenied5. Rerun unchanged outside restricted filesystem token: artifacts/usb-hid-final-verifier-native.log, exec session88187; must record its actual exit rather than claim previous pass proves current run. No unrelated verifier checks altered. No live classdeny/SetupAPI changes, no physical acceptance claim, no new commit yet.

Final native qualification PASS exit0, actual SYSTEM precommit rollback and postcommit preservation plus inactive/pending cleanup. New private fixture is inactive; original interrupted fixture authenticated recovery passed earlier. Final unchanged full verifier native PASS exit0. Affected PnP tests199 and recovery-task testsPASS. Owner RP2040 baseline QUACK absent; read-only RP2040 function/keyboard/mouse reportsOK/problem0, so no valid physical blocking comparison yet. Restore positive baseline before physical trials; no current newlivepolicytransition.
