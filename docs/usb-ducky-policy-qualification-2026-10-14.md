# Exact Ducky policy qualification

Owner confirmed Ducky unplugged. No device-install policy was applied.

Windows Professional and the installed DeviceInstallation ADMX support the exact-instance deny schema: DenyInstanceIDs DWORD 1, DenyInstanceIDsRetroactive DWORD 1, and an exact physical USB instance under DenyInstanceIDs. This alternative targets the selected Ducky including its storage. It does not establish universal first-keystroke prevention.

`tools/usb/ducky-policy-core.ps1` is an inert planner. It rejects HID paths, composite interface paths, wildcard roots, injected characters and invalid operation nonces. It produces a bounded probe namespace or the documented live namespace. Activation is unavailable; the generated rollback throws before accessing the registry. Do not remove this gate to perform a trial.

Focused tests `tools/usb/tests/ducky-policy.ps1` passed: exact scope, rejected targets/nonces, parsed encoded rollback and executable refusal before registry access. No native policy acceptance is claimed.

Independent review found incomplete-write recovery and validation/deletion race concerns. The prototype now retains empty namespaces instead of deleting keys, but the remaining concerns require implementation before activation.

Next work: implement durable admin-owned prior-state/intent journal before each mutation; create a new namespace atomically and refuse existing policy; recover every owned partial prefix while preserving foreign entries; serialize Sentinel operations and detect external policy changes. Exercise injected failure after every mutation and foreign changes. Prove immutable scheduled SYSTEM rollback in a private probe namespace before applying the exact-device rule. Then verify reconnect blocking, ordinary input usability, actual rollback and Ducky usability. Registry readback alone is insufficient.

Previous native disable returned CR_NOT_DISABLEABLE. Existing filter lifecycle is unqualified and its active paths remain disabled. Do not resume those trials or alter the Ducky firmware to manufacture a blocking result.

## 15 October continuation: controlled trial candidate

Native registry transactions were implemented but private HKCU and elevated private HKLM creation both returned Win32 6801 (resource manager inactive) before commit. They are not qualified on this machine. No system repair or device restriction was performed through that route.

The alternative `DuckyPolicyEntry.cs` writes a standard numbered exact-instance entry, with the deny-enable DWORD last. Recovery removes only that entry if the nonce owner and exact target still match; it never deletes namespaces or clears global flags. Default builds reject the live namespace. The explicit lab runner is a controlled device trial, not an installed protection service.

Focused native private HKCU tests passed all five interrupted preparation prefixes, repeat recovery, foreign-entry preservation and ownership/target drift refusal. A separate preparation process then exited at the third write stage in a private machine namespace; the independent immutable repeating SYSTEM task removed the entry, with exit-zero and native registry readback. The complete private preparation/SYSTEM recovery probe also passed. Both proofs bind to the captured adapter SHA-256. These tests do not prove actual Ducky blocking or restored input.

Independent review resolved optional-mode fallthrough, ancestor ownership and source/probe version binding. The candidate requires Ducky absent, no existing Restrictions namespace, anchored administrator/SYSTEM-only durable receipt, serialized operations and a repeating independent five-minute reversal before writes. It preserves all ordinary input rules. Neither a successful receipt nor a prepared policy can be shown as actual input blocking.

The first sandboxed repository verifier failed on native quarantine storage/ACL tests; the native-access rerun passed (artifacts/ducky-policy-verify-native.log, exit 0). Live preparation and post-recovery Ducky input still require observed evidence. Source files for this stage: DuckyPolicyEntry.cs, DuckyPolicyJournal.cs, ducky-policy-trial.ps1, ducky-policy-live-trial.ps1 and their focused tests.
