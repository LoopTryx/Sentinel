# Native USB recovery broker transport

Implemented on Engineer A's issue-12 branch, stacked PR74. This is a recovery-only native bootstrap and engine, not completed input quarantine. No machine factory, installed startup task, HKLM policy mutation or HID blocking was invoked.

## Native entry points and authority

- `UsbBootstrap.Main([])` runs only as the fixed protected `ProgramFiles\Sentinel\Usb\Sentinel.UsbBootstrap.exe`, opens the fixed protected ProgramData journal, and launches the fixed `Sentinel.UsbBroker.exe`. Both binaries require administrator approval. There is no renderer, plugin, IPC listener or other child-launch path in this process.
- `UsbJournalTransport.StartMachine(journal)` is restricted to that dedicated entry assembly. Retained executable ancestry, exact protected Admin/SYSTEM-only application-directory and binary ACLs, regular-file identity and reparse refusal precede launch. The three accepted filenames are Bootstrap, Broker and Recovery DLL. Higher system ancestry rejects untrusted replacement permissions.
- `STARTUPINFOEX` passes only duplicate journal/directory handles plus a completion event through `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`. Other inheritable handles are excluded. On success the parent relinquishes its journal; the child retains ancestry independently. Launch failure preserves parent ownership, attempts bounded owned-child termination, and surfaces termination failure. The completion event is not ongoing watchdog readiness and cannot authorize policy application.
- `UsbRecoveryHost.Main(["--recover-inherited", encodedHandles, completionHandle])` accepts only the fixed protected broker path and administrator context. Child import validates the inherited handles again against the fixed ProgramData path, protected ACLs, regular-file/link count, reparse refusal and journal size. Arguments are native bootstrap-generated; no browser-supplied handles or paths are accepted.
- `sentinel_usb_recover(isize ownedFileHandle) -> u32` consumes a non-inheritable, already validated duplicate. Return codes: 0 restored or no pending record, 1 recovery failed and recovery remains required, 2 unsupported/invalid sentinel. The Rust engine opens authoritative `JournalStore`, invokes authoritative `Recovery::recover_pending` and `PolicyBackend`, and exports no apply/enroll action. The journal's durable delta determines recovery; the constructor profile cannot be applied by this engine. Panics are caught at the FFI boundary. No device IDs or journal bytes are returned.
- The fixed Recovery DLL loads with DLL-directory/System32 search flags while its file and protected app ancestry remain retained. The inspected release import table contains only Windows system libraries/API sets; no bundled native dependency is required.

## Verification

`tools/test-usb-journal-transport.ps1`: actual disposable private native file handoff, child path/ACL validation, ancestry retained after parent disposal, exact byte persistence, unrelated inheritable parent event excluded, wrong-path child failure cleanup, and refusal to launch machine transport from the test executable PASS. The exclusion assertion checks the parent's actual event because numeric handles can be reused by the child runtime.

`tools/test-usb-native-recovery-engine.ps1`: authoritative Windows provider copied with only test-scoped HKCU construction/drift helpers; production recovery core restores nonce-owned synthetic registry state. Drift conflict preserves the journal; resetting that exact synthetic drift allows owned restoration, native empty readback, journal clear and idempotent restart PASS. Three failed test attempts retained harmless HKCU leases during diagnosis; all three were recovered with the same core and their exact scratch keys/journals removed. No machine provider call occurred.

`tools/test-usb-private-journal.ps1` PASS. Separate native-engine strict Clippy/unit tests PASS. Complete `tools/verify.ps1` PASS in `artifacts/usb-broker-transport-verify.log`; its printed browser manual instructions were not executed for this increment. `apps/desktop/build-console.ps1` builds the desktop plus both administrator hosts and the locked offline release recovery DLL. Independent security review found inheritance-environment and executable-directory issues; both were corrected, and static recheck found no remaining blockers. Static review is not machine/hardware acceptance.

## Required continuation

1. Policy handoff/capacity dependency resolved by the owner's explicit transfer to Engineer A and implementation of32 exceptions/4072-byte encoded bound. See usb-policy-capacity-2026-10-14.md for tests and independent review; reviewed integration is still pending.
2. Protected installation/provisioning with independent startup/watchdog recovery. Building the recovery executables does not install or schedule them. ProgramFiles/ProgramData factories remain uncalled.
3. Native authenticated baseline and per-connection owner authority wired into serialized apply logic, separate from recovery-only completion. A new journal intent cannot proceed from this completion signal alone.
4. Actual controlled first-input refusal with everyday input preserved, crash/lease/restart recovery and reconnect acceptance. Do not expose Held/active protection before this evidence. If Windows installation restrictions cannot meet that criterion, report the limitation and use a reviewed input filter architecture rather than mislabel post-arrival disable as containment.

Defender remains enabled; CRYPTIC E: untouched. No live malware, input-policy activation or automatic device enrollment.
