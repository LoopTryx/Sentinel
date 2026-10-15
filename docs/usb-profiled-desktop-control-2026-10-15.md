# Profiled Ducky control in Sentinel

## Implemented scope

USB Guard → Manage device and the tray menu → Profiled USB control open the same native panel. Hold for 5 minutes and Release request Windows administrator approval through a fixed-purpose compiled helper. The renderer only opens the panel; it cannot submit a device identity, arbitrary command, path or policy data.

The helper uses the already qualified device profile in the administrator/SYSTEM-only ProgramData journal. There is no automatic enrollment of attached devices. Other machines without that profile refuse the action. This is known-instance Windows installation control, not general unknown-HID quarantine, power switching or a cryptographic device identity.

Hold first qualifies an immutable repeating SYSTEM recovery action against a private registry probe. It preserves a durable receipt and continuous recovery coverage, binds to the exact profile, then sets the selected deny entry and refreshes Windows policy. Automatic and explicit release both remove only the owned entry and refresh policy. Global flags and foreign policy are not erased. Rearming requires the previous device recovery to be healthy; unresolved task retirement refuses another hold until Release finishes recovery. Both task identities survive an interrupted retirement.

Machine profile metadata is created atomically with SYSTEM/Administrators write access and Users read access. Status validates the profile, policy schema and value types. Armed is distinct from a missing device driver; problem 28 is not represented as proof of policy causation. Native notifications report state changes and requested-action completion; timeout outcomes remain unknown. Closing Sentinel does not cancel scheduled recovery.

## Actual device evidence

The first registry-only attempt did not stop the payload: root and keyboard problem codes remained zero. After Windows policy refresh and reconnect, the owner reported “The installation of this device is forbidden by system policy.” Native readback recorded root error/problem 28 and no present correlated keyboard. This is a tested configuration, not universal first-input prevention.

Removing the deny entry alone did not restore the device. After policy refresh, native root problem returned to zero, and the owner explicitly confirmed QUACK ran again with normal keyboard and mouse working. The original completed trial task was retired only after those recovery checks. CRYPTIC E:, Defender and unrelated input policies were unchanged.

## Verification

- Full native-access tools/verify.ps1: passed, artifacts/ducky-app-verify.log. Initial sandbox-only temporary-storage failures are retained separately.
- Desktop build, including the dedicated manifested helper: passed, artifacts/ducky-app-build.log.
- Visible glass-console smoke: passed, artifacts/ducky-app-smoke.log.
- Focused USB UI tests: 3 passed, artifacts/ducky-ui-tests.log.
- Private exact-entry tests: interrupted write prefixes, foreign entry preservation, ownership/target drift refusal, expired-arm refusal and repeat arm/release passed.
- Fixed-purpose helper command rejection and retirement-timeout/restart regression: passed via apps/desktop/tests/ducky-policy.ps1.
- Actual private HKLM enrollment publication, rebinding refusal, partial-record refusal and restart refusal: passed via apps/desktop/tests/ducky-enrollment.ps1. No actual USB policy was altered by these metadata tests.
- Independent review findings on task coverage, task tracking, atomic enrollment, profile-bound status, timeout wording and recovery UI were addressed.

## App acceptance route

Open USB Guard → Manage device. Choose Hold for 5 minutes and approve Windows. Reconnect the enrolled Ducky; record the Windows result, harmless payload outcome, normal input usability and notification visibility. Choose Release and approve Windows; reconnect and confirm the harmless payload and ordinary controls again. Repeat the cycle, then leave the device released. These app-button and notification observations remain pending until actually performed; the prior direct controlled trial does not substitute for them.

This implementation is on the owned PR74 branch pending coordinator integration. It does not complete broad USB input quarantine or the whole S1 milestone.

## App acceptance follow-up

The first screenshot came from an older running backup installation: the single-instance launch brought that window forward. The exact stale process was shut down after its authenticated runtime shutdown, and the newly built console was launched. No backup files were deleted.

The first native-panel attempt remained Hold off and failed before creating a deny entry. Its recovery-registration script nested an already encoded action in another EncodedCommand, exceeding Windows' 32767-character process command limit. The fixed helper transports its internally generated management script with a bounded self-contained gzip/Base64 loader. No caller script or mutable file is loaded. A regression uses the actual recovery payload, proves the old command exceeds the Windows limit, executes the new loader in native Windows PowerShell, and verifies explicit failure/exception propagation. The native panel now displays redacted failure stages. This fixes a reproduced app-path failure; another actual app hold/release check is still required.

## 15 October: inline device control and release investigation

Owner confirmed the live app hold stopped only the Ducky; normal controls remained working. After Allow, the owner still observed no QUACK. Read-only inspection found the exact deny entry absent, root healthy/problem 0, and healthy current HID descendants. The originally recorded keyboard instance was no longer present. The harmless firmware sends once, two seconds after physical startup. Firmware timing versus Windows enumeration is a hypothesis; successful post-release typing remains unverified. No firmware was altered to manufacture a result.

The new card lives inside Connected input and storage. It remains visible for the enrolled device when blocked or unplugged. Exact native root matching excludes that device from the generic inventory projection; friendly names never authorize actions. Block arms the existing five-minute Windows installation rule; Allow removes it and refreshes Windows policy. Neither is universal HID interception. The card separately shows rule state, connection/input-driver readiness, and bounded automatic release. Always-on automatic blocking is not enabled by this increment.

Native contract (trusted Glass origin only):

- `usb.ducky.status`, `{}` → `{state,title,detail,input}`. `state`: off, armed, driver_unavailable, unavailable. `input`: ready, disconnected, input_missing, input_error, unavailable. Example: `{state:"off",title:"Hold off",detail:"Reconnect the Ducky after releasing a hold.",input:"ready"}`. Metadata only, no identifiers, keystrokes or storage contents.
- `usb.ducky.block`, `{}` → same projection on success; fixed native `hold` helper. Requires visible active console, no competing native dialog/selection, then Windows administrator approval. Independent recovery qualification and five-minute release task precede the owned rule. No renderer-selected device/registry/script.
- `usb.ducky.allow`, `{}` → same projection on success; fixed native `release` helper. Removal and policy refresh are followed by current parent-and-keyboard-descendant health checks before recovery tasks retire. A healthy parent alone is insufficient. Unplugged/missing/error descendants leave recovery available and return stage 41. Reconnect then retry Allow.
- Errors return `{error:string}`. Cancellation differs from 120-second unknown outcome. Renderer waits 150 seconds, suppresses concurrent actions, and permits Allow again after a disconnect/reconnect. No cancellation claim for an elevated operation already running.

Arrival notifications now use native enrolled policy status for the exact profile; ordinary USB devices retain observation-only status. Rule-armed wording does not claim measured interception of first keystrokes. Driver ready does not prove a firmware payload typed.

Validation: focused UI regressions (inline fixed actions, disconnect recovery, independent inventory ordering), native parent-only/missing/failed-child classification and CM class-GUID constant, fixed-purpose helper rejection/task-retirement/command codec, plus full verifier/build/native smoke. Logs: `artifacts/ducky-inline-verify.log`, `artifacts/ducky-inline-build.log`, `artifacts/ducky-inline-smoke.log`. See current issue handoff for final outcomes. Live inline Block→reconnect→Allow→reconnect typing/notification acceptance is still required; do not call this complete or merge on fixture results.

### Follow-up: installed keyboard but no typing

Owner reported the inline Allow/reconnect route shows input driver Ready but no QUACK. Read-only checks confirmed `DuckyInputHealth.Read = ready` and exact deny-entry absence. Verified board CDC COM port opened, but writes timed out with bounded read/write timeouts. No HID commands, policy mutation or firmware writes were performed. The initial unbounded serial diagnostic was stopped by exact PID + creation time + command signature before retrying with explicit timeouts. CIRCUITPY on D: remained readable and its startup script unchanged (once at physical startup, two-second delay). E: was not accessed.

Conclusion: recovery typing acceptance remains FAILED/PENDING, despite driver installation readiness. Do not claim a payload timing root cause or a successful end-to-end release. Requested ten-second physical power-off/reconnect and board LED pattern to distinguish board/endpoint stall from policy. If it persists, capture bounded startup/USB endpoint evidence; do not fake success by changing the payload or widening device policies. UI driver readiness must not be described as proof of input delivery.

### 15 October: installed launch and clarified preflight failure

The installed shortcut was launching an old Desktop-backup copy. Replaced the canonical per-user Desktop installation from the tested package, preserved the prior installation, verified 188 file hashes, preserved Chrome native registration, fixed the desktop shortcut, and confirmed the running canonical app binary/runtime. This was a local installation update, not a main merge/release.

Owner subsequently identified the actual inline error: protected profile or recovery journal (stage 31), rather than an indefinitely busy action. An elevated fixed read-only diagnostic returned 90: enrolled/private profile binding, journal identity/task formats and retiring-task absence passed. Stage 31 also covered unrelated preflight checks. Those now have distinct errors: 42 unresolved previous recovery; 43 owned namespace/rule; 44 policy refresh before arm; 45 enrolled root must remain connected during prior-recovery check. UI now says to keep connected while preparing and reconnect only after Block armed. Existing arming/recovery/security ordering is unchanged.

With the Ducky kept connected during the owner's retry, the installed helper exited and the exact enrolled target + operation marker were confirmed armed. Prior stage-31 cause is not conclusively identified, but a connected-preflight requirement contradicted the earlier unplug instruction. Physical refusal and normal-control acceptance are pending; automatic five-minute reversal remains enabled.

PASS: new native error-contract regression; fixed-purpose helper/retirement/codec regressions; two inline UI tests; UI and native builds. Independent review found no blocker. Updated diagnostic wording is built in the checkout but not yet copied over the running installed app while the owner's active blocking trial is in progress.

Correction to the earlier serial observation: the diagnostic omitted DTR. With DTR enabled the board console worked, reported SafeModeReason.NONE and no prior script exception. A controlled rerun reported Typing test complete but the owner saw no Windows input. After a Windows restart the owner confirmed QUACK worked. This does not establish Interception as the cause, and no keyboard-filter configuration was changed. Reliable release without restart remains unresolved.

### Repeat-arm failure and bounded refresh candidate (not yet qualified)

Owner showed Block armed + driver Ready while QUACK executed. A same-session native read confirmed exact enrolled target/nonce, DWORD deny=1 and retroactive=1 with current keyboard ready. The rule had not expired. This is a FAILED live blocking trial, not protection. Matching SetupAPI policy-removal records were from the earlier 08:03 local success; no fresh matching installation-policy check appeared for this reconnect.

Private notification investigation: child-only list re-arm did not signal a parent LAST_SET watcher; setting the parent to the same value also did not signal. A real parent 0→1 change did. Ordering controls mattered, so only the isolated child-first/changed-parent control result is relied on. This establishes registry notification behavior only; Windows policy-consumption remains a hypothesis.

Candidate: after validating the exclusive owned three-value/one-subkey namespace and exact nonce/target, reassert the deny DWORD 0→1 after arm, or after release with an empty list. No classes, wildcards, new device IDs, driver removals or filter changes. Restore never reasserts when foreign entries are present, preserves partial Apply prefixes, and repairs an interrupted owned flag-0 state to original flag1 with an empty list. A flag0 snapshot is unavailable/unarmed. Tests interrupt before0/at0/after1 and verify recovery. This transient flag change is a new candidate behavior; the older 'never change global flags' description is superseded only for this fully exclusive owned namespace.

The existing helper completed Allow with exit0 before this source/encoding change, including its validated task retirement. New compressed scheduled actions remain self-contained and deterministic; changed/foreign task actions must still cause refusal. Do not bypass task-identity checks to migrate a live old task.

Independent review found no blocker for a bounded exclusively owned trial, conditional on no unmatched old recovery tasks. Private tests pass; actual repeated refusal and release without a Windows restart remain required. UI no longer asserts that an enrolled device is restricted merely because its rule exists. No successful candidate hardware result is recorded here.

### Candidate baseline check: no activation

Owner reported silence on insertion BEFORE clicking Block. Native read at 2026-10-15T06:53:09Z confirmed enrolled rule absent, owned nonce matched, keyboard-driver state ready, and no Ducky helper running. CIRCUITPY was healthy on D:. This attempt is INCONCLUSIVE for candidate blocking because its positive typing baseline failed; no candidate rule was activated by this check.

Read-only source/process audit found only the installed Sentinel.Glass process, no old hold/interception test process. Current Glass input monitoring registers observation flags0x2100, not suppression. Dormant DuckyFilterHold source selects a unique hardware-ID match and refuses ambiguous selection, but opens multiple filter contexts during discovery; earlier context teardown stalled. No filter handles were opened, no macro enabled, no routing broadened, and no drivers changed. Do not activate that backend as a fallback. Requested known recovery: save work, Ducky absent, Windows restart, normal reconnect, verify QUACK BEFORE any Block. If the baseline remains silent, stop enforcement trials and retain unqualified status.

### Stage 32 reproduced: nested command transport exceeded Windows limit

Owner screenshot: Allowed/Ready with stage32, before any rule. Offline reproduction exposed the exact generated ScheduleScript and passed it through the actual command encoder: the outer management command exceeded its28000character guard, although the inner compressed recovery action fitted. This exception happened before launching task-registration PowerShell, so the error was not evidence of Task Scheduler permissions or an enforcement failure.

Fix: retain compressed/base64 trusted payload, but pass the fixed ASCII decompression loader as one quoted -Command argument instead of re-encoding that loader in UTF16 Base64. Loader rejects double quotes/newlines; task-registration and retirement literals double apostrophes. No cmd.exe, external script reload, new device IDs or policy behavior. Old action strings are still exact-match checked; no task-migration bypass.

Regression now measures the full scheduling pipeline, not only its inner command. It executes the actual generated management script under Windows PowerShell with every task cmdlet overridden by inert functions; captured action must equal the original exactly. Existing deterministic/action-size, oversized legacy marker, exit7/exception1 and retirement-restart tests remain. Independent review found no quoting/security blocker. Existing old real actions were retired by successful Allow; stage32 candidate attempts never reached registration. Actual installed scheduling and hardware refusal/release acceptance remain pending.

Stage32 transport fix validation: full tools/verify.ps1 PASS (artifacts/ducky-schedule-verify.log), native regression PASS with scheduled action5794chars and management6922chars, desktop build and visible smoke PASS (ducky-schedule-build.log, ducky-schedule-smoke.log). The former full-pipeline guard failure was reproduced before the fix. Independent quoting/security review found no blocker. This establishes command transport only; actual task registration and refusal/release remain pending owner acceptance.
