# USB gate/recovery core — implementation candidate

This is broker-internal Rust logic, not active Windows USB protection. It installs no policy, driver or privileged IPC. No current application calls it. Independent review, native wiring, durable private store, independent recovery process and physical hardware acceptance are required before enabling enforcement.

## Check it

This crate is temporarily an isolated workspace to avoid editing peer-owned root manifest/lock/bootstrap files. Root `tools/verify.ps1` does **not** test it. Run all three explicit checks as well as the unchanged root verifier:

```powershell
cargo fmt --manifest-path crates/sentinel-usb/Cargo.toml -- --check
cargo clippy --manifest-path crates/sentinel-usb/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path crates/sentinel-usb/Cargo.toml
```

## Decision contract

`Gate` retains at most 64 live connections. A fresh broker-generated random 16-byte run nonce and monotonic serial distinguish connections and jobs; identifiers are correlation, never credentials. Detach, re-enumeration, changed interfaces or device identity must retire the connection. A service restart must use a different nonce. The broker derives time and authorization, never accepts these assertions from web/UI fields, serializes actions and freshly validates native identity/policy before each action.

`connect` produces observations, never a hold. `confirm_hold` may be called only after the platform freshly verifies the requested interface's actual hold. It cannot establish pre-input coverage from a late disable or a notification. Unsupported interfaces remain a separate gap. Storage and HID states and action proposals are independent; the backend must not approve a composite parent to release a child.

`begin_inspection` requires held storage; `finish_inspection` accepts only its exact current job/connection. Only a whole-scope reviewed `CompleteNoFindings` result younger than 120 seconds permits a storage-release proposal. Worker exit, demo results, incomplete traversal, parser refusal, stale feeds or empty signature sets cannot become that result. `invalidate_inspection` revokes decisions immediately; the scanner controller separately owns cancellation/join and must retain admission until actual exit.

`request_release` is explicit and requires broker-derived scoped authorization. It does not run a platform action. Call `revalidate_release` immediately before native mutation, rechecking current caller rights and actual connection/policy identity within the serialized broker. `complete_release` consumes the proposal. Failed, delayed or superseded callbacks expose a gap rather than claim a hold survived; a trusted adapter must revoke/reverify. `policy_lost` invalidates reports/actions and every protection claim. Clock rollback does the same. No automatic release, suspicious override, blanket protection state or payload classifier exists here.

## Recovery contract

`Recovery` begins in RecoveryRequired. Startup must call `recover_pending` before enabling new changes. `arm_apply` requires an empty exclusive store, captures at most 4072 bytes, and persists/syncs a versioned envelope **before** applying. A lease lasts 1–300 seconds; there is no renewal implementation yet. Only successful platform verification reaches Applied. Finding an unexpired journal reaches Armed, not proof of applied policy.

The production `Store` must enforce private ownership/ACLs, exclusive mutation, atomic crash-durable persistence, bounded reads, validated encoding, durability on clear and safe corrupt-record handling. The opaque backend snapshot must encode the exact narrowly owned target, prior value and expected installed value. The production `Backend` must recheck unchanged baseline before apply, refuse unrelated policy drift, restore idempotently only its owned change and freshly verify restoration before clearing. This crate does not provide those Windows implementations or authenticate arbitrary bytes. The 4096-byte record includes an 8-byte version marker and two bounded timestamps; corrupt/oversized records refuse mutation and remain a visible recovery failure.

An independent watchdog must call `recover_due` even after UI/service failure; this library is not that watchdog. Expiry, backwards wall clock or startup triggers restoration. Recovery can disable protection to restore input; it must be shown as such. Failure/conflict preserves recovery intent and cannot silently overwrite another administrator's changes.

## Integration dependencies

Engineer B owns this slice under issue12 handoff6099690602 and claim6100413399. Engineer A retains AV/commands.rs/generated selected-scan integration. Published scanner contract and typed actual job controls are on PR61; picker/authenticated native wiring remain pending. Shared root registration and native wiring require an explicit editing-owner agreement. The physical matrix must prove clean/suspicious/partial storage handling, pre-input benign RP2040 denial, composite separation, reconnection/reboot, drift and independent recovery. No daily-machine policy/HID tests, live malware or E: access.
