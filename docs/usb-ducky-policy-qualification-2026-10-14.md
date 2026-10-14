# Exact Ducky policy qualification

Owner confirmed Ducky unplugged. No device-install policy was applied.

Windows Professional and the installed DeviceInstallation ADMX support the exact-instance deny schema: DenyInstanceIDs DWORD 1, DenyInstanceIDsRetroactive DWORD 1, and an exact physical USB instance under DenyInstanceIDs. This alternative targets the selected Ducky including its storage. It does not establish universal first-keystroke prevention.

`tools/usb/ducky-policy-core.ps1` is an inert planner. It rejects HID paths, composite interface paths, wildcard roots, injected characters and invalid operation nonces. It produces a bounded probe namespace or the documented live namespace. Activation is unavailable; the generated rollback throws before accessing the registry. Do not remove this gate to perform a trial.

Focused tests `tools/usb/tests/ducky-policy.ps1` passed: exact scope, rejected targets/nonces, parsed encoded rollback and executable refusal before registry access. No native policy acceptance is claimed.

Independent review found incomplete-write recovery and validation/deletion race concerns. The prototype now retains empty namespaces instead of deleting keys, but the remaining concerns require implementation before activation.

Next work: implement durable admin-owned prior-state/intent journal before each mutation; create a new namespace atomically and refuse existing policy; recover every owned partial prefix while preserving foreign entries; serialize Sentinel operations and detect external policy changes. Exercise injected failure after every mutation and foreign changes. Prove immutable scheduled SYSTEM rollback in a private probe namespace before applying the exact-device rule. Then verify reconnect blocking, ordinary input usability, actual rollback and Ducky usability. Registry readback alone is insufficient.

Previous native disable returned CR_NOT_DISABLEABLE. Existing filter lifecycle is unqualified and its active paths remain disabled. Do not resume those trials or alter the Ducky firmware to manufacture a blocking result.
