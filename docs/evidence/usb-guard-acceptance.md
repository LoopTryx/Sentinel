# USB Guard acceptance — owner-approved HID default-deny design

## Scope and current result

PR #74. Current published base: 9cd5cf5. The 17 October owner plan supersedes the earlier exact-deny-only proposal: one USB\\Class_03 compatible-ID deny, retroactive enabled, layered evaluation, exact internal-safety and owner-approved external instance exceptions. Block removes only an approval; Allow adds only the selected approval. No DenyUnspecified, competing exact-deny owner, parent/hub/storage restriction, force flag or automatic reboot.

**Not accepted for general/default-deny deployment.** One RP2040 trial passed; an external keyboard and optical mouse failed physical blocking. New native/default-deny source is being qualified with activation withheld. Saved policy does not establish rejected input.

## Evidence carried forward

| Check | Result | Evidence and limit |
|---|---|---|
| Named producer jobs | PASS on qualified source | Actual default-owner named Local/Global probes and full private worker lifecycle passed. Explicit SYSTEM owner failed Win32 1307 (ERROR_INVALID_OWNER); named isolation and DACL retained. |
| Historical baseline COM exception | ROOT CAUSE UNPROVEN | Original log lacked HRESULT/call context; later independent read-only qualification passes. No invented apartment diagnosis. Context/HRESULT diagnostics added. |
| Recovery contention | FIXED / PASS | 0x80070020 sharing violation from monitor reopening the active writer fence. Read-only registration monitoring and consistent decision/baseline/GPO lock order fixed it. |
| Empty deny-list handling | FIXED / PASS | Actual recovery failed Legacy deny list missing; disposable HKCU reproduced it red then green. Missing empty list is accepted, foreign/nonempty drift still refused. Actual corrected authenticated recovery passed with zero blocks/no pending. |
| Private SYSTEM policy recovery | PASS | Actual protected worker and SYSTEM task, multi-target preservation, before-commit rollback, after-commit preservation and cleanup; synthetic private registry only. |
| RP2040 physical Block | 1 owner-observed pass | Working QUACK baseline after restart, then no QUACK after Block/reconnect. No broad coverage claim. |
| External keyboard Block | FAIL | Owner reports typing continued. |
| Optical mouse Block | FAIL | Owner reports ~3 seconds interruption then input returned; committed exact policy and saved/effective readback agreed, native started=True/problem=0/need_restart=False. |
| Mouse policy release | Owner-reported PASS | Owner confirmed Allow cleared the rule; not proof of every other release journey. |
| Protected built-ins/recovery usability | Owner confirmed | Latest answer: Recovery keyboard verified; keyboard and trackpad both work in normal Windows. Recovery trackpad support is not claimed. |

## New implementation verification

New canonical admission state uses distinct versioned formats, owner/generation/receipt/topology binding and immutable internal exceptions. Compiler approvals feed the existing authoritative Rust policy compiler; aggregate bound32/encoded4072 is retained. SetupAPI adapter targets one validated USB HID function and complete bounded descendants, checks DN_DISABLEABLE, uses DIF_PROPERTYCHANGE and returns Pending verification/Restart required/Failed rather than inferring Blocked from a return code.

Exact commands, fresh results and changed files are appended below as they finish. No machine activation has been performed for this new model.

## Mandatory controlled acceptance

| Scenario | Status |
|---|---|
| Unknown keyboard denied on connection, including early accepted-input measurement | PENDING |
| Previously installed external keyboard and mouse individually blocked | FAILED on prior backend; new path PENDING |
| Built-in keyboard/trackpad unaffected by new active policy | PENDING |
| Allow restores only selected device; two blocked then Allow-one | PENDING |
| Actual restart persistence of denial and approvals | PENDING |
| Reconnect/other port/hub/composite HID+storage | PENDING |
| Killed worker/interrupted updates restore only owned PnP changes | PENDING |
| Policy, PnP status and independent physical input counts agree | PENDING |

Raw Input counts/fixture markers must be per-device without logging keystroke content. A native status, policy readback, successful API result or mock is insufficient. If controlled policy+SetupAPI testing still accepts unapproved input, stop policy-value experimentation and evaluate a Microsoft KMDF HID filter, keeping default-deny unshipped until qualified.

## 18 October qualification checkpoint

No new live DeviceInstall rule or SetupAPI transition has been applied. Engineer B's UI and unrelated sound changes remain preserved.

| Command/check | Outcome |
|---|---|
| `tools/verify.ps1` unchanged | PASS exit 0, `artifacts/usb-hid-owner-plan-full-verifier.log` |
| `tools/usb/tests/test-usb-hid-admission-policy.ps1` | PASS 37 pure assertions |
| `tools/usb/tests/build-usb-hid-admission-kernel.ps1` | PASS 11 modeled assertions; existing transaction/store algorithm reused in distinct namespace |
| `tools/usb/tests/test-usb-hid-admission-gpo.ps1 -Hkcu` | PASS 15 assertions, disposable current-user fixture; no machine enforcement |
| `tools/usb/tests/UsbHidSetupApiTest.ps1` | PASS 20 modeled assertions |
| `tools/usb/tests/UsbHidPnpTransactionTest.ps1` | PASS 194 modeled assertions including parent-commit/lost-reply reconciliation |
| `tools/usb/tests/UsbHidCommittedDisableLedgerTest.ps1` | PASS 23 assertions with injected authenticated-source fixtures |
| `tools/usb/build-usb-hid-raw-input-probe.ps1` | Build and pure count/marker test PASS; visible measurement not run |
| Owner-approved native read-only tree inspection | PASS exit 0; four validated external functions, two disableable and two non-disableable; no transitions |
| Owner-approved protected PnP journal test | PASS 21 assertions, actual protected persistence/reopen/CAS/fence; ownership source remains fixture, not production |
| New admission private backend | BUILD PASS; actual elevated run FAIL stage 2, InvalidOperationException 0x80131509 at Launch; precise subprocess diagnostic retry pending |

The new private backend uses distinct protected paths/tasks/jobs, the actual hash-pinned Rust compiler, and synthetic entries outside DeviceInstall restrictions. Build success is not runtime qualification. The original reviewed worker is retained during diagnostic retry so interrupted state is not abandoned by replacing its hash.

Review found a parent-policy/PnP commit gap. Recovery now requires an authenticated parent-decision resolver under the same writer fence: candidate committed reconciles the Applied PnP record; before committed permits inverse recovery; unknown decisions refuse. The regression failed before the API existed and passes after the fix. Production integration must supply that resolver, not a constant callback.

Remaining integration blockers: protected parent history and disable receipts must be durably linked before task retirement; recovery must handle narrowly authenticated descendant disappearance/reappearance without selecting a different device; policy-only Allow must not arbitrarily enable foreign-disabled nodes; activation cannot silently claim success for skipped non-disableable functions. These are code dependencies, not missing owner permission. Physical acceptance and Windows restart testing remain PENDING.

## 18 October verified results

New actual private backend qualification PASS exit0: `artifacts/usb-hid-private-v2-retirement-fixed.log`. Protected named suspended worker activation, AllowA/AllowB/BlockA preservesB, real SYSTEM precommit rollback and postcommit preservation, deactivation and pending cleanup all passed. This does not exercise live DeviceInstall, Windows Hello, SetupAPI transition, authentic built-in receipt, physical input or restart.

Private runtime findings/fixes: independent gpupdate /wait30 exited-1 after35205ms while operational events confirmed Registry CSE328ms/manual completion0sec. New private write uses asynchronous refresh plus bounded30sec recognizable effective-image convergence and strict saved/effective verification; no success from async launch alone. Original interrupted private fixture authenticated rollback PASS exit0. Scheduler running-item enumeration raced COM0x8004130B (no running instance); only this specific stale-item error is ignored and fresh authenticated task/stopped-state checks remain mandatory. Other COM errors propagate.

Unchanged full verifier PASS exit0 outside restricted filesystem token: `artifacts/usb-hid-final-verifier-native.log`. Earlier sandbox run failed13 retained-file tests with AccessDenied5; checks were not weakened. Final affected PnP tests PASS199 after idempotent committed-recovery regression. Focused recovery-task tests PASS after narrow race fix.

Owner's requested observation-only RP2040 baseline FAILED: QUACK did not run before new blocking. Read-only present-device PnP inspection shows RP2040 composite, storage, HID function, keyboard and mouse all OK/problem0. This proves Windows reports healthy, not that input works. Do not credit silence as prevention. No new live default-deny/SetupAPI transition performed. Positive baseline must be restored before hardware trials. Existing installed console/UI is unchanged.

## RP2040 positive input baseline — 18 October

Owner confirms QUACK ran and saved the visible observer report. The actual report is `docs/evidence/usb-rp2040-baseline-2026-10-18.json`: RP2040-Zero159 baseline events, baseline marker85543ms, first/last90546/92377ms. Test marker absent (-1), testevents0, blockingProven=false.554 events were unresolved, so no whole-system per-device coverage is claimed. No key content/native IDs were recorded and policyChanged=false. This is a positive fixture baseline only; it is not evidence that the new default-deny path rejects input.

Fixed a source integration case test-first: policy-restored healthy Allow previously threw not_sentinel_disabled. A healthy target now receives no PnP action; rollback likewise leaves it untouched. Actual problem22 devices still require authenticated Sentinel-owned disable receipts before enable.201 modeled PnP assertions,23 ledger assertions and7 journal assertions pass. This behavior has not yet been installed or physically qualified.

## Linked production path — 18 October

The saved RP2040 baseline is now positive: owner QUACK confirmed,159 attributed events. Current live source links native card selection, foreground/session-bound single-use Windows Hello proof, protected worker, same-decision-lock parent/PnP history, independent recovery and saved/effective policy readback. The old exact engine is excluded under its own short read lease during live GPO operations; no old class-wide controller was enabled.

Recovery schema SNTPNP02 persists connector and directed HID-tree witnesses. Strict fresh selection remains separate from recovery; old records without the new witnesses cannot authorize recovery. Before-policy Prepare persists original PnP state and ownership, AfterPolicy uses the exact witness. Policy-only restriction/restoration performs no SetupAPI change or disable-ownership minting.214 modeled assertions pass;33 SetupAPI mapping/recovery assertions pass. Parent commitlinks are written before parent commit and become authoritative only through the actual committed tip. Mandatory in-lease commit AND retirement hooks prevent bypassing reconciliation.

Owner-approved actual protected tests:
- usb-hid-linked-store-native.log: PASS22 real protected parent/link/PnP file assertions with modeled PnP.
- usb-hid-device-lifecycle-native.log: PASS24 connected lifecycle assertions with modeled PnP.
- usb-hid-install-read.log: updated lifecycle PASS30 incl mandatory retirement-hook refusal; code-only installer PASS; production read PASS active=False generation1 internalExceptions2 externalApprovals0. This initialized only inactive local state and verified original policy baseline, not device enforcement.

Builds PASS: build-usb-hid-controller.ps1, build-usb-hid-operator.ps1, build-usb-hid-production-read.ps1, build-usb-hid-runtime-installer.ps1; test-usb-hid-backend-wiring.ps1 PASS14. Native selection/Hello-binding contracts PASS33 synthetic. Saved legacy-field parsing reproduced Foreign admission field then fixed: disposable HKCU suitePASS17, changed baselineflags still refuse. Parent/link codecPASS5; journalcodecPASS8; ledgerPASS23. Production compile is isolated by explicit live-linked symbols and runtime worker/compiler/profile stamps; no mock is used by native construction.

Console route and explicit Enable USB Guard implemented. Per-device Allow cannot implicitly activate a shared rule. Frontend action payloads remain opaque references/topology; native selection/Hello is required. Focused UI testsPASS9; typecheck/buildPASS. Unchanged tools/verify.ps1 PASS exit0 outside restrictedfilesystem token, artifacts/usb-hid-linked-final-verifier.log. No unrelated check weakened.

Owner exited tray app. Matching USB operator installed using existing protected installer with backup, usb-hid-console-operator-install.log. Console/UI copied with prior console backup and new executable hash70D9E75FEDEBAD3E7B8A2E58284F865D38D7B3CE0D960510F35DAD50B2135A08 verified; launched --app --display-check. Ordinary source audio work remains separate/uncommitted; local build includes existing workspace audio assets. This is not a main release.

Physical activation requested through USB Guard Enable USB Guard + Windows Hello, then RP2040 reconnect and built-in keyboard/trackpad check. Await owner result. No PASS claimed for new live default-deny, Allow, two-device physical preservation, appclosure or Windows restart persistence. If a controlled accepted-input test fails, stop policy-value tweaks and apply the owner-specified filter-driver fallback decision.
