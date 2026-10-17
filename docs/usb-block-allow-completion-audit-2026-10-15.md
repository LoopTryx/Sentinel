# RP2040 USB Block/Allow: completion audit — 15 October 2026

Scope: reliably block and release the already enrolled RP2040 on this Windows installation, then expose the verified action in Sentinel. General unknown-HID quarantine is a separate requirement; a profiled-device policy cannot establish universal pre-input protection.

## Evidence and failure causes

| Observation | What it establishes | What remains uncertain |
|---|---|---|
| Both exact physical-parent and keyboard-interface disable returned0xE0000231 | Windows refuses the direct PnP disable route as critical | No force override was attempted; changing wrapper cannot overcome this result |
| Earlier Windows installation-forbidden notification | At least one policy trial reached installation enforcement | Why later trials let QUACK run; exact policy processing/child lifecycle must be correlated |
| Later exact registry entry present while driver ready and QUACK ran | Registry presence is insufficient enforcement evidence | Saved-policy processing, timing, existing child installations and other policy interaction |
| Existing runtime edits effective HKLM rather than saved local GPO | Concrete persistence/workflow difference | Saved GPO is a candidate, not proven to solve hardware enforcement |
| Allow removed rule/driver reported ready but typing sometimes returned only after reboot | Problem-code0 is insufficient recovery evidence | Firmware startup, USB enumeration and HID endpoint state require separate positive baseline |
| Defender flagged encoded source-based recovery action | That recovery transport is not qualified and must not be replayed | Detection alone does not classify the native replacement or prove malware/false positive |
| Native SYSTEM job containment passed earlier | Hung worker/descendant locks released within measured bound in that test | Production crash, reboot, sleep and clock behavior still need acceptance |
| Review found recovery could precede final producer save and cleanup could reuse it | Actual cleanup ordering defect | Corrected regression/build pass; real private qualification pending |

## Candidate approaches

1. Preferred current experiment: supported saved-local-GPO persistence for the same exact enrolled instance, with native bounded workers and independent recovery. Keep saved and effective policy, actual installation result, and typing behavior as separate evidence.
2. If parent-only policy fails: inspect the exact connected composite-child ancestry and SetupAPI policy decisions; consider exact child enrollment only if evidence shows an escaping interface. No global HID class/VID policy or hub/controller changes.
3. Direct disable is rejected on this device. Do not retry the same operation through different wrappers expecting a different guarantee.
4. General first-input prevention needs an appropriately reviewed input/USB authorization layer installed before device arrival, or external USB gating hardware. A user-mode arrival notification or one-minute observation cannot undo an earlier keystroke. Existing interception backend remains unqualified and off.
5. RP2040 firmware disabling its own typing is a controlled demonstration mode, not host-enforced protection against an untrusted device. It cannot be substituted as acceptance for Sentinel blocking.

## Completion sequence

- Fix producer/recovery ordering: every producer must fit the earliest independent deadline. After producers stop and release locks, request a NEW recovery run and then a fresh saved/effective-release verifier. Never reuse an older successful recovery result.
- Qualify native SYSTEM private save/apply/independent release, preserving unrelated policy. Test delayed/failed producer and broker exit cases; record exact stage rather than state-only success.
- Finish reviewed production recovery/journal handling, including prior v1 action migration, crash/sleep/reboot/clock behavior and occupied/foreign policy refusal. Do not enable unfinished code merely because the private fixture passes.
- One controlled actual-device trial: positive QUACK baseline, Block with policy-processing/native evidence, repeated reconnects without QUACK, normal controls unaffected, Allow returning QUACK without reboot, and automatic release returning QUACK. If baseline is silent, stop measuring blocking and diagnose enumeration/firmware first.
- Integrate verified backend in the existing device card and notifications. Distinguish requested/processing/policy-saved/blocked/allowed/reconnect-required/restart-required/error; rule-present must not say blocked.
- Review, build/install, repeat installed journeys, publish exact evidence and obtain coordinator integration. No percentage or completion claim before these pass.

## Current increment

New regression calls the real WaitPrivate method against a non-mutating fake scheduler. It first reproduced old-success reuse, then passed after fresh-dispatch enforcement. Existing deadline regressions and native qualification build pass. Independent review cleared the scoped harmless private SYSTEM trial only; it does not authorize a completed-protection claim. No DeviceInstall restriction or installed app change is made by this increment.

References: Microsoft Manage Device Installation with Group Policy; IGroupPolicyObject::Save; TaskSettings.AllowHardTerminate. These describe the supported mechanisms, not evidence of this product's hardware acceptance.

### Verified continuation — recovery ordering and native private SYSTEM trial

The old-success regression reproduced the actual WaitPrivate defect before the patch. After correction it passes. Independent review found the prior ordering blocker resolved and no remaining concrete blocker for the private trial, while explicitly withholding device-policy qualification.

Defender custom scan completed and the native binary remained available; real-time protection was true. The native `private-gpo` broker completed with receipt State=complete,Stage=0,Scenario=native-private-gpo,NativePrivateSavedRecovery=1 and exited. That result includes private baseline, saved hold/effective check, independent scheduled release, fresh saved/effective release verification, and a new cleanup release plus newly registered verifier after producer quiescence. No DeviceInstall restriction was written and no installed app was replaced. This is native recovery mechanism evidence, not Ducky enforcement evidence.

Focused checks: ducky-fresh-recovery.ps1 PASS; ducky-worker-lease.ps1 PASS; ducky-worker-private-modes.ps1 PASS; rp2040-target.ps1 PASS; build-ducky-worker-qualification.ps1 PASS. Whole verifier result is recorded separately below when available.

Supported mechanism sources:
- https://learn.microsoft.com/en-us/windows/client-management/manage-device-installation-with-group-policy
- https://learn.microsoft.com/en-us/windows/win32/api/gpedit/nf-gpedit-igrouppolicyobject-save
- https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-allowhardterminate

Full verifier: sandbox run failed13 filesystem tests (access-denied/storage initialization); unchanged native-access rerun tools/verify.ps1 PASS, exit0, artifacts/ducky-recovery-order-native-verify.log. No test or capability gate was weakened.
