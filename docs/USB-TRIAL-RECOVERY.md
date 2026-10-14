# Sentinel USB trials: recovery and current state

Read this on the nearby laptop before testing. The owner authorizes trials on the current laptop and wants this repository record available for recovery; the nearby laptop is a reference/recovery aid, not the test target. This does not establish an independently usable input path on the test laptop.

## Current state — 14 October 2026

No live USB/HID restriction, PnP removal, filter-driver installation, test-signing setting or scheduled machine rollback has been applied by this trial session. Read-only capture found the DeviceInstall restrictions namespace absent and the current process not elevated. Blocking trials completed:0. No input quarantine is active.

Current implementation source: PR74, issue branch `codex/engineer-a/issue-12-usb-approval-recovery`. Relevant earlier heads:33f5be3 policy capacity;06f405f recovery-only transport/engine;12a3031 revised Phase0 assessment. Code is not all integrated into main. Tests in disposable HKCU namespaces are not evidence of active protection.

Existing components: physical-parent grouping; observation-only input monitor;32-entry instance-exception policy bounded by4072 encoded bytes; private journal and native recovery transport; consent verifier and per-connection one-use permit components. New-scope gaps: signed Hello challenge, authenticated SYSTEM service/IPC, independent installed watchdog, last-known-good recovery, full descriptor/port fingerprinting, verified internal exemptions, external Bluetooth enforcement, installed/hardware acceptance.

Earlier rollback restores an empty prior policy. It must not be used as the requested last-known-good fail-closed recovery. Earlier consent outcome is not the requested signature proof. See [Phase0 record](usb-phase0-2026-10-14.md), [policy capacity evidence](usb-policy-capacity-2026-10-14.md) and [native transport evidence](usb-native-broker-transport-2026-10-14.md).

## Before any live change

- Keep the Ducky absent while identifying everyday controls. Do not auto-enroll all currently attached devices. The six platform entries counted earlier are metadata, not proof that all internal controls have been safely exempted.
- Correlate owner use of the built-in keyboard/trackpad to native device identity and separately validate bus/parent/connector classification. Preserve explicitly approved external controls. A device name, VID/PID or the word internal is insufficient.
- Capture the exact pre-trial registry state privately. The next preflight must recheck it; the currently absent namespace must not be assumed to stay absent. Refuse MDM/administrator policy and unrelated drift. Do not publish raw device IDs, recovery keys or credentials.
- Implement and exercise the timed privileged reversal before policy application, prove it can run independently of this console, and record its deadline/outcome. A document or a queued task alone is not reversal evidence.
- Verify recovery-environment access and an independently usable fallback input path. Keep any BitLocker recovery key privately available; never send it to the agent or repository.
- Establish firmware USB transfer instrumentation and host probes with positive controls. CircuitPython's typing-attempt messages do not prove host report consumption. Missing/lost/unattributed evidence is inconclusive.

No broad class-deny-only trial is authorized by this checklist until it can preserve internal controls under the owner's hard rule. A nearby laptop and the intention to exempt controls do not prove this. The owner requested this laptop as the target, but has not completed the requested recovery-path check; no verified replacement exists yet.

## If something goes wrong

1. Unplug the Ducky. Stop trials. Do not repeat a failed change or connect another unknown HID as a workaround.
2. If Windows input still works, use only the exact trial's validated reversal, verify native state and everyday controls, then save the result. There is currently no installed trial reversal to run. Do not issue a blanket `reg delete` against DeviceInstall or remove unrelated keyboard/mouse filters.
3. If input fails, wait for the pre-tested timed reversal, using the recorded deadline. If no reversal was installed/tested, the trial should not have started. A power cycle is not proof that restrictions will disappear.
4. Use the nearby laptop to read this guide and the last published checkpoint. It cannot directly repair the other laptop without an established access/recovery path.
5. For Windows Recovery/Safe Mode, Microsoft's documented route is Recovery Environment → Troubleshoot → Advanced options → Startup Settings → Restart → Safe Mode. Encrypted devices may require the owner's BitLocker key. Safe Mode access is DOCUMENTED, not VERIFIED for this laptop; it is not a promise that device policies cease to apply.
6. If Safe Mode input is also unavailable, use a previously verified recovery environment or qualified recovery assistance. Offline registry recovery must use the exact installed Windows hive, private backup and owned delta; no generic offline deletion command is provided because no live trial delta exists yet. Do not guess drive letters, touch E: (CRYPTIC), reset the PC, disable Defender, disable signature enforcement or change unrelated filters.

[Microsoft startup settings](https://support.microsoft.com/en-us/windows/experience/startup-boot/windows-startup-settings) and [BitLocker recovery-key guidance](https://support.microsoft.com/en-us/windows/security/encryption/find-your-bitlocker-recovery-key) support the recovery route. These are instructions, not evidence that this machine's fallback works.

## Trial checkpoint requirements

Before each change, publish a small checkpoint: code head; trial identifier; exact policy mode and layering; private backup location and hash (not its contents); trusted control proof references; reversal command/helper identity and tested outcome; deadline; owner-accessible recovery route; firmware/host probe readiness. After each trial, record timing, marker/report consumption and host delivery separately, live PnP state, storage result, internal/fallback usability, reversal outcome and artifact hashes. Keep raw private traces locally.

Mark observations VERIFIED only for what was actually observed; Microsoft semantics DOCUMENTED; untested expectations ASSUMED. Each required matrix cell remains NOT RUN0/20 until independent evidence is captured. Never substitute registry readback, a silent device, successful pairing or an attractive UI for containment.
