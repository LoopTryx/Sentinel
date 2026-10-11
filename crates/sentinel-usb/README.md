# USB gate/recovery core — implementation candidate

This is broker-internal Rust logic, not active Windows USB protection. It now includes a native registry policy backend, but no current application calls it and no policy, driver or privileged IPC has been activated. Independent review, native wiring, durable private store, independent recovery process and physical hardware acceptance are required before enabling enforcement.

## Check it

This crate is a root workspace member. `tools/verify.ps1` and existing Windows CI include its formatting, lint and tests through workspace-wide commands. Focused checks are:

```powershell
cargo fmt --all -- --check
cargo clippy -p sentinel-usb --all-targets -- -D warnings
cargo test -p sentinel-usb
```

## Decision contract

`Gate` retains at most 64 live connections. A fresh broker-generated random 16-byte run nonce and monotonic serial distinguish connections and jobs; identifiers are correlation, never credentials. Detach, re-enumeration, changed interfaces or device identity must retire the connection. A service restart must use a different nonce. The broker derives time and authorization, never accepts these assertions from web/UI fields, serializes actions and freshly validates native identity/policy before each action.

`connect` produces observations, never a hold. `confirm_hold` may be called only after the platform freshly verifies the requested interface's actual hold. It cannot establish pre-input coverage from a late disable or a notification. Unsupported interfaces remain a separate gap. Storage and HID states and action proposals are independent; the backend must not approve a composite parent to release a child.

`begin_inspection` requires held storage; `finish_inspection` accepts only its exact current job/connection. Only a whole-scope reviewed `CompleteNoFindings` result younger than 120 seconds permits a storage-release proposal. Worker exit, demo results, incomplete traversal, parser refusal, stale feeds or empty signature sets cannot become that result. `invalidate_inspection` revokes decisions immediately; the scanner controller separately owns cancellation/join and must retain admission until actual exit.

`request_release` is explicit and requires broker-derived scoped authorization. It does not run a platform action. Call `revalidate_release` immediately before native mutation, rechecking current caller rights and actual connection/policy identity within the serialized broker. `complete_release` consumes the proposal. Failed, delayed or superseded callbacks expose a gap rather than claim a hold survived; a trusted adapter must revoke/reverify. `policy_lost` invalidates reports/actions and every protection claim. Clock rollback does the same. No automatic release, suspicious override, blanket protection state or payload classifier exists here.

## Recovery contract

`Recovery` begins in RecoveryRequired. Startup must call `recover_pending` before enabling new changes. `arm_apply` requires an empty exclusive store, captures at most 4072 bytes, and persists/syncs a versioned envelope **before** applying. A lease lasts 1–300 seconds; there is no renewal implementation yet. Only successful platform verification reaches Applied. Finding an unexpired journal reaches Armed, not proof of applied policy.

The production `Store` must enforce private ownership/ACLs, exclusive mutation, atomic crash-durable persistence, bounded reads, validated encoding, durability on clear and safe corrupt-record handling. The opaque backend snapshot must encode the exact narrowly owned target, prior value and expected installed value. The production `Backend` must recheck unchanged baseline before apply, refuse unrelated policy drift, restore idempotently only its owned change and freshly verify restoration before clearing. The Windows policy backend implements the configuration delta only; the production Store and independent recovery process remain unimplemented. It does not authenticate arbitrary journal bytes. The 4096-byte record includes an 8-byte version marker and two bounded timestamps; corrupt/oversized records refuse mutation and remain a visible recovery failure.

An independent watchdog must call `recover_due` even after UI/service failure; this library is not that watchdog. Expiry, backwards wall clock or startup triggers restoration. Recovery can disable protection to restore input; it must be shown as such. Failure/conflict preserves recovery intent and cannot silently overwrite another administrator's changes.

## Integration dependencies

Engineer B owns this slice under issue12 handoff6099690602 and claim6100413399. Engineer A retains AV/commands.rs/generated selected-scan integration. Published scanner contract and typed actual job controls are on PR61; picker/authenticated native wiring remain pending. Shared root registration was accepted in issue12 comment6100535864 and implemented under claim6100874585. Native wiring needs its separate editing-owner agreement. The physical matrix must prove clean/suspicious/partial storage handling, pre-input benign RP2040 denial, composite separation, reconnection/reboot, drift and independent recovery. No daily-machine policy/HID tests, live malware or E: access.

## Windows input policy backend

Claim: issue12 comment6101016312. `policy::InputPolicy` accepts1–8 exact, unique instance IDs, each at most200 ASCII bytes, with no wildcard/control characters. These are trusted native approval inputs, not proof of authentic hardware. The fixed profile prepares instance exceptions, denies HIDClass/Keyboard/Mouse setup classes, enables policy layering and includes previously installed devices. It affects non-USB input devices in those classes too. It does not deny disk/network setup classes or claim storage containment.

`PolicyBackend` implements `recovery::Backend`. It starts only when the fixed DeviceInstall Restrictions namespace contains no values or unknown subkeys; known empty list keys are tolerated. It never merges with administrator/MDM policy. The bounded versioned journal payload captures the implicit empty prior value state and complete expected installed profile. The adapter checks the entire expected prefix before each write, and writes the deny switch last. Recovery accepts only exact owned values or a subset left by interrupted application, removes the deny switch first and flushes before journal clear. Empty keys are left in place; unrelated keys/values are never recursively deleted. Arbitrary/truncated records, altered values, unknown subkeys and failures preserve recovery-required state.

`policy::windows::WindowsRegistry` uses native Win32 registry APIs and a fixed HKLM path. Constructor/read operations do not mutate. Reads use fixed-size buffers, reject registry links/unknown subtrees, and have bounded enumeration. Handles close through RAII. Writes refuse an existing value on the same held key; deletes recheck that exact value. These are checked operations, not atomic compare-and-swap against other privileged writers. A concurrent administrator/GPO writer can race the check; managed-policy coexistence must remain unavailable until an integration protocol is reviewed. Do not describe this as tamper-proof enforcement.

`verify_applied` proves only that registry values match. `verify_restored` proves only that the owned values are absent. Neither proves that Plug and Play consumed policy, that keystrokes were blocked before arrival, or that a previously disabled device regained input. The final native broker must verify those separately, retain appropriate recovery intent until functional recovery is established, and never call `Gate::confirm_hold` based solely on this backend's Applied state. No native enrollment, policy refresh, OS-edition/support probe, durable private Store, independent watchdog, trusted confirmation, runtime interface release or installation/uninstallation path is delivered here. HID activation remains unavailable.

Executed native tests use unique `HKCU\Software\SentinelUsbTests` fixture keys with synthetic identifiers, not Windows policy keys. Cleanup runs on test exit, including assertion failures. The actual HKLM policy target was not opened or written. These tests demonstrate registry API behaviour only, not hardware denial.

Product approach: hold input before it reaches applications; scan storage through the existing bounded AV/isolated-worker journey separately; explicitly approve HID; retire approvals on reconnection/policy loss. A clean file result or a quiet sandbox period never automatically releases HID. Timing heuristics and VID/PID reputation are supplementary signals, not a trust boundary. Device impersonation, unsupported interfaces and physical/electrical attacks remain outside any blanket protection claim. A signed installer/update path, crash/reboot/uninstall recovery, supported Windows matrix and independent security/hardware acceptance remain required before selling a protection claim.

Primary references checked10 October2026: [Microsoft DeviceInstallation policy and layering](https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-deviceinstallation), [Microsoft ADMX list and retroactive value mapping](https://learn.microsoft.com/en-us/windows/client-management/understanding-admx-backed-policies), [Microsoft device installation lab guide](https://learn.microsoft.com/en-us/windows/client-management/client-tools/manage-device-installation-with-group-policy). Native API behaviour: [RegQueryValueExW](https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regqueryvalueexw), [RegSetValueExW](https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regsetvalueexw). These sources describe OS configuration semantics, not Sentinel product acceptance.
