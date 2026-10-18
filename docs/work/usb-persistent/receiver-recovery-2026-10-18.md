# Receiver recovery — 18 October 2026

## Actual Windows evidence

The read-only authenticated diagnostic found an active committed HID policy at generation 12 with three external function approvals and two built-in exceptions. Both 2.4G Receiver HID functions were approved, present, started, and reported problem code 0. The optical mouse was approved and healthy. RP2040 remained unapproved, with an unconfigured HID function (problem 1). Inventory was complete, with no unresolved classifications. No policy was changed by this diagnostic.

This proves that another Allow-list edit is not the immediate receiver fix. It does **not** prove that the keyboard delivers input: the owner still reports no external-keyboard typing. The receiver has multiple functions and collections, so a root status alone is insufficient evidence of recovery.

## Supported approaches, in order

1. Verify the selected function approvals against actual saved/effective policy; already passed for both receiver functions.
2. Restart only the approved receiver HID function instances with the existing exact-device recovery executor. Keep the receiver connected and check actual keyboard input afterward.
3. If restart is ineffective, collect its exact exit/status and inspect the HID collections, then evaluate a scoped PnP rescan. Do not treat an unexecuted or cancelled elevation as a failed restart.
4. Consider exact function-instance removal and re-enumeration only if the evidence justifies it, after verifying the selected parent/tree and approvals. Do not delete the shared HID driver package, restart a hub/controller, use force, or reboot automatically.

The reviewed owner-operated restart trial uses native inventory, a unique external receiver group, actual protected approval verification, immutable built-in exclusions, and fresh one-use Windows Hello verification. It invokes the existing `UsbAdmissionDeviceRecovery`, not a new blocking implementation. The first launch was cancelled in Windows; it produced no restart log. The direct relaunch requires owner approval/Hello. No physical recovery result is claimed yet.

## Product code change

Allow previously rejected a fully approved card as “unchanged.” The console now has a recovery path for that case: resolve the selected native group, verify every target is approved, obtain a new Hello proof bound to the owner/state/topology/targets and a fresh nonce, then attempt exact-function reconnection. No policy generation or grant is changed for this retry.

For a newly approved card, optional reconnection follows durable commit and saved/effective readback, and covers only the original Hello-bound changed targets. Enumeration/restart failures remain partial recovery results instead of erasing a successful policy result. Mandatory final protected-state verification still fails if the decision changes. The tab distinguishes a completed Windows restart attempt, a Windows-restart requirement, and an unsuccessful attempt requiring replug. None means physical input was verified.

The original six-argument `Change` entry point remains available for existing recovery helpers. The console calls the distinct `ChangeAndReconnect` entry point. Policy compilation, worker isolation, recovery tasks and built-in enrollment are unchanged by this increment. Independent source review found no additional blocking issue after correcting the post-commit enumeration failure boundary. Existing per-step policy/generation checks are retained; no claim is made that they eliminate every cross-process Windows PnP race.

## Verification

| Check | Result |
| --- | --- |
| `test-usb-hid-admission-selection.ps1` | PASS, 48 synthetic selection/authorization assertions |
| `test-usb-admission-device-recovery.ps1` | PASS, immutable scope, argument checks, release gate, truthful outcomes; no native restart |
| `test-usb-admission-restart-selection.ps1` | PASS, protected/internal/duplicate/incomplete/stale refusal |
| `UsbHidPnpTransactionTest.ps1` | PASS, 222 modeled assertions |
| `UsbHidSetupApiTest.ps1` | PASS, 52 fake-transition assertions |
| `test-usb-hid-pnp-file-journal.ps1` | PASS, 9 journal assertions |
| `build-usb-hid-operator.ps1` | PASS, linked controller/operator compilation; existing unused-field warning |
| unchanged `tools/verify.ps1` | PASS outside the filesystem sandbox; all available T01 checks. Sandbox-only run failed Windows quarantine storage/path metadata tests with access/path errors. No Rust code was changed. |
| Receiver restart and actual typing | PENDING owner-approved native trial |
| New operator installed/physically accepted | PENDING; source/build evidence is not installed acceptance |

Detailed local logs are in `artifacts/usb-receiver-recovery-read.log`, `artifacts/usb-receiver-reconnect-full-verifier-native.log`, and the restart trial log when the action actually executes. Do not publish machine-specific identifiers or raw device logs.

## External implementation references

- [Microsoft PnPUtil](https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/pnputil-command-syntax): per-instance restart and scoped scan. No force, global selection or automatic reboot in this trial.
- [Microsoft DevCon implementation](https://github.com/microsoft/Windows-driver-samples/blob/main/setup/devcon/cmds.cpp): class-installer property-change restart; the existing executor uses PnPUtil rather than bypassing class installers with direct CM transitions.
- [Microsoft device uninstall guidance](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/how-devices-and-driver-packages-are-uninstalled): removing a device instance differs from deleting its driver package; Windows can reinstall from the retained store after re-enumeration.
- [Microsoft Defender device-control overview](https://learn.microsoft.com/en-us/defender-endpoint/device-control-overview): installation restrictions and removable-media access controls are different mechanisms. Storage device-control success is not proof of live keyboard interception.
- [ESET device control](https://help.eset.com/ees/12/en-US/idh_config_devmon.html): commercial device-control behavior and restart requirements; its proprietary implementation is not public Sentinel evidence.
- [HidHide FAQ](https://docs.nefarius.at/projects/HidHide/FAQ/): gamepad HID hiding does not handle keyboard/mouse input paths in the same way. It is not a drop-in keyboard quarantine solution.

These are published engineering/vendor references. No professional was contacted and no third-party driver or antivirus was installed.

## Follow-up after the owner's Windows restart

The owner reports that the external keyboard works again. The new authenticated read finds USB Guard inactive at generation 13, with the same two internal exceptions and three external function approvals. Both receiver roots, the wired mouse and RP2040 report problem code 0. This is a working baseline, not evidence of a successful new Block/Allow cycle.

`Install-UsbReceiverRecovery.ps1` then installed only the reviewed console operator through the existing protected operator installer. Actual policy verification before and after installation both returned inactive generation 13 with unchanged approval/exception counts and complete inventory. The installed executable's SHA-256 matches the reviewed linked operator build. Reflection checks confirm the unique original six-argument `Change` API and the new seven-argument `ChangeAndReconnect` API. No worker, policy, task or device access was changed by installation.

Sentinel was opened for an owner-operated receiver Block/Allow/replug trial. Activation, selection and Windows Hello remain native owner actions. Physical acceptance of this installed update is pending that trial. The original standalone restart diagnostic was not executed; its cancelled launches are not counted as recovery failures.

## Receiver Block failure reproduced and repaired

The owner reports the keyboard still typed after Block. Actual policy readback remained active generation 14 with both receiver function approvals retained. Protected PnP journals for three failed Block attempts were `Recovered pending physical verification`, revision 1, two entries, no intent and no observed mutation. The keyboard function was healthy/started but non-disableable; the other receiver function was disableable. This locates the failure before any native mutation: `pnp_disable_unavailable` aborted the whole transaction and restored its policy. It was not a successfully committed restriction being ignored by Windows.

New behavior: an originally healthy non-disableable target records `Reconnect required` without intent, mutation or disable ownership. It retains the parent policy restriction after saved/effective verification instead of forcing a disable or undoing the restriction. The UI continues to distinguish policy verification from physical input blocking. A dedicated read-only block-policy observer handles a Windows policy transition that removes the original HID driver: it verifies fresh external classification, physical connector, exact root identity and the captured compatible-ID witness. Existing native mutation witnesses are unchanged and still refuse non-disableable devices and uninstalled-HID representations.

Regressions: PnP **226 PASS**, SetupAPI **61 PASS**, journal **9 PASS**, parent links **5 PASS**, disable ledger **23 PASS**. The first non-disableable regression reproduced the original refusal before the fix. Actual protected parent/link/PnP qualification **45 PASS**, including policy-only Block/Allow and preservation of another device's ownership. Its device transitions are explicitly modeled and do not prove physical enforcement. Independent security review found no blocking authorization, scope, ownership or rollback issue.

The owner disabled Guard before installation. `Install-ReceiverPolicyRuntime.ps1` used the existing authenticated inactive-runtime upgrade path, immutable worker images, manifest backup and protected console-operator installer. Post-install actual readback: inactive generation 15, two internal exceptions, three retained external function approvals, complete inventory, healthy roots. Protected manifest hash matches the reviewed worker; installed operator hash matches the built operator. No restrictions or device changes were activated by installation. Owner-operated Block/replug and Allow/replug acceptance is now requested. Do not claim success until physical input is checked.

Kaspersky's published [BadUSB guidance](https://support.kaspersky.com/keswin/11.7.0/en-US/176739.htm) describes a distinct keyboard authorization feature. This is behavior guidance, not publicly available implementation code or evidence that Sentinel has equivalent input interception. No Kaspersky code, binary or driver was copied or installed.

## Physical Block acceptance

After installing the non-disableable-keyboard fix, the owner completed Block for 2.4G Receiver with Windows Hello, unplugged/reconnected the receiver, and confirmed: **“External keyboard stopped; other controls work.”** This is owner-observed real hardware evidence for the selected receiver after replug. It does not establish immediate pre-replug interception, Allow recovery, application-close persistence, Windows-restart persistence, or all other USB models. The next requested test is selected Allow with Hello, followed by a five-second unplug/reconnect and actual keyboard typing.

The owner then completed selected Allow with Hello and unplug/reconnect, confirming **“yup! works”** in response to the keyboard-restored/other-controls-working check. The receiver therefore has owner-observed physical Block/replug and Allow/replug acceptance. Windows restart persistence, two-device Allow-one preservation on physical devices, and immediate pre-keystroke interception remain separate unverified acceptance criteria.
