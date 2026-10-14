# Input quarantine progress and Engineer B handoff

Updated 14 October 2026. Implementation/evidence head: `31e063f`.
Owner explicitly requested publication and Engineer B takeover. Engineer A releases its input-quarantine file claims to B for this continuation; A will not make overlapping edits. B should record acceptance and use a new owned issue branch from this exact published head, preserving the stacked ancestry.

## Repository coordinates

- Repository: private LoopTryx/Sentinel.
- Issue: https://github.com/LoopTryx/Sentinel/issues/12
- Branch: codex/engineer-a/issue-12-usb-approval-recovery.
- Draft PR74: https://github.com/LoopTryx/Sentinel/pull/74 (base codex/engineer-a/desktop-v2-20261013).
- Parent draft PR73: https://github.com/LoopTryx/Sentinel/pull/73 (base main).
- These changes are published increments, not reviewed integration into main. Do not cherry-pick only the final test commit without its dependencies.
- Local checkout: `.local-handoff/main-scan-integration`. Untracked `apps/desktop/NativeConsole.cs` is unrelated preserved work, outside this transfer and not included in this handoff. Do not overwrite it.

## Current result

Sentinel DOES NOT quarantine HID input. There are zero successful live first-input containment trials. Popup/identity/recovery/signing components do not constitute a blocker. No meaningful completion percentage or reliable finish-time estimate has been established.

| Part | Evidence and exact remaining gap |
| --- | --- |
| Physical device/source correlation | UsbInputIdentity.cs, UsbInternalDetection.cs, UsbConnectorEvidence.cs and UsbControlProbe.cs. Owner-guided native read-only observation correlated 3 Ctrl events with internal USB keyboard port; 521 touchpad Raw Input packets with specific ACPI/I2C HID usage. Additional device-zero movement remains unattributed. No active exemption/enrollment. |
| Native arrival popup | UsbGuardArrival.cs and UsbGuardPopup.cs, wired in GlassConsole.cs/build-console.ps1. Receiver arrival and one visible native popup confirmed by owner. Allow once disabled; unavailable status honest. Bounded notification ledger, no hard native query deadline; not admission control. |
| Signed challenge authority | UsbGuardAuthority.cs: connection/caller/action bound challenge, expiry, replay and detach refusal; synthetic RSA tests pass. Caller authentication is a seam, not actual authenticated SYSTEM IPC. |
| Windows owner-key signing | UsbHelloSignature.cs compiles with native projection; opens existing key and requests signature, never auto-enrolls. Genuine owner-key enrollment/signing not tested. Consent Boolean is not the new authority. |
| Restrictive rollback | sentinel-usb policy.rs / policy/windows.rs: temporary exceptions over last-known-good restrictive baseline, durable recovery, exact native verification, drift refusal. Capacity 32 exceptions, 4072-byte encoded bound. Native disposable HKCU test passed. |
| Crash/hang guardian tests | test-usb-recovery-process.ps1 and test-usb-restrictive-watchdog.ps1. Owned hidden child/job before scratch apply; crash and hang restore restrictive baseline, verify cleared journal then explicit scratch cleanup. Independent static review resolved missing crash containment. Not an installed privileged watchdog. |
| Recovery-only native broker | ProtectedUsbJournal.cs, UsbJournalTransport.cs, UsbBootstrap.cs, UsbRecoveryHost.cs and native/usb-broker-engine expose recovery only. Protected production provisioning/startup absent; no authenticated apply. |
| Installed blocker, service, watchdog | UNFINISHED. UsbGuardService.cs is planned, not implemented. No proven pre-input backend. |
| Hardware qualification | Phase0 zero live trials; firmware USB completion logging not established. No universal protection claim. |

## Checks and known failures

Final commands passed: `tools/test-usb-restrictive-watchdog.ps1 -Hang`, same without -Hang, and `tools/test-usb-recovery-process.ps1`. Full `tools/verify.ps1` passed; local log artifacts/usb-watchdog-verify.log. Independent review was static and scoped to modified tests.

One repeated test during concurrent verification failed guardian exit check AFTER recovered marker. Subsequent direct and complete repeat passed. Cause UNRESOLVED; do not hide it or call guardian production reliable. Failed sandbox setup left a baseline journal only, recovered with exact native cleanup; no live policy changed. Failure coordinates now include primary and baseline journals. Cleanup refuses conflicting registry state.

Previous local full verifier and native console build passed; installed current GUI/extension acceptance is separate. Hosted CI previously stopped before jobs due billing; owner waived automatic checks, but no hosted pass is claimed. Fetch current check annotations if needed.

## Owner/hardware state

Owner permits testing on this laptop and explicitly transferred B policy files to A earlier; this handoff now transfers A quarantine claims to B. Owner reports Windows Recovery keyboard works, trackpad does not, and returned to Windows. This is owner-reported keyboard-only fallback, not independent Safe Mode/offline restore proof. Do not repeat resolved built-in source tests unnecessarily. Current physical connections must be freshly observed; do not infer from older user replies. Defender stays enabled; CRYPTIC E: untouched. No blanket class-deny on daily machine that violates built-in-control preservation. No live malware or EICAR. Do not log secrets, raw identifiers, keystrokes or raw private traces.

## Next work, in order

1. Reproduce the intermittent guardian exit failure with explicit bounded exit/error diagnostics and verify recovery cleanup. Do not widen timeouts merely to conceal the failure.
2. Implement/install protected independent recovery supervision with fixed trusted executable paths, protected journals, explicit owned policy delta, safe rollback and truthful capability state. Review privilege boundary before activation.
3. Complete authenticated SYSTEM service IPC and genuine owner-key enrollment/signature verification. Existing authority and signing classes are components, not a service. Do not substitute an admin Yes/No Boolean for cryptographic owner verification.
4. Establish an actual Windows admission mechanism that stops the FIRST input report. Evaluate owner Phase0 matrix; post-arrival disabling and passive Raw Input observation do not prove first-input prevention. If policies fail, decide on correctly signed filter-driver work rather than pretend notifications block.
5. Wire service state/allow/revoke to existing native popup and desktop UI, with disconnect invalidation and failure states; no UI claims of blocked until verified enforcement.
6. Controlled harmless Ducky tests: independent firmware transfer completion and host delivery accounting; preserve built-in/fallback controls and prove rollback. Record exact policy/layering, reboot/lockscreen/hotplug/identity/port coverage. Owner spec requires >=20 per qualification cell, not a single Notepad success.
7. Publish exact evidence, peer review, then coordinator integration. Keep issue open until actual acceptance.

## Authoritative reading

AGENTS.md; docs/AI-COLLABORATION.md; docs/Sentinel-Master-Plan.md; docs/phase-1-70-30.md; STATUS.md; fresh chat.md and issue/PR comments. Also docs/usb-phase0-2026-10-14.md, docs/USB-TRIAL-RECOVERY.md, docs/usb-quarantine-continuation-plan-2026-10-13.md, docs/usb-watchdog-recovery-2026-10-14.md, docs/usb-signed-notices-2026-10-14.md, docs/usb-restrictive-approval-recovery-2026-10-14.md, docs/usb-input-attribution-2026-10-14.md and sanitized docs/evidence/usb-* JSON.

Original revised owner test specification was pasted locally at `C:\Users\LENOVO LOQ\.codex\attachments\7448c035-6b75-4e33-b477-44e7c17020ae\Pasted text.txt`; consult it if available, otherwise use the Phase0 repository document and ask only for irreducibly missing test requirements. Raw local artifacts are not public evidence and may not exist on B's machine.
