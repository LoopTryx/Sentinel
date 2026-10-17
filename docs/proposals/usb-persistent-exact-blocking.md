# Persistent exact-device USB input blocking

Status: implementation proposal, 16 October 2026. This document does not describe a shipped capability or authorize a live policy change.

## Owner outcome

A USB Guard card's **Block** changes only that card's freshly identified external USB HID interfaces. The committed block survives closing Sentinel and restarting Windows. **Allow** removes only that card's committed deny entries. Neither operation enables a global USB-class deny, approves unrelated devices, or changes built-in keyboard/trackpad rules. New unknown devices remain outside this explicit-target feature; automatic unknown-device containment is a separate product decision.

The previous global-class path cannot acquire this behavior by removing its five-minute deadline. Its `SNTADM01` journal, `UsbAdmissionTransaction.ApplyInitial`, `INativeBackend.OutstandingRecoveryDeadlineUtc`, expiry worker and cleanup stages explicitly implement temporary empty-baseline admission. Its allow-list updates also affect unrelated pending devices. They remain distinct from this backend.

## Smallest supported Windows policy scope

Use saved local computer Group Policy and fresh effective readback for the exact list `DeviceInstall/Restrictions/DenyInstanceIDs`, with `DenyInstanceIDs=1` and `DenyInstanceIDsRetroactive=1` while the managed list is nonempty. Do not write `DenyDeviceIDs=USB\Class_03`, allow lists, class GUID deny lists, default deny, administrator overrides, or parent/hub/controller restrictions. When the list becomes empty, restore the authenticated pre-feature baseline, not a guessed empty machine-wide policy.

Microsoft documents the [device-instance installation restriction and retroactive option](https://learn.microsoft.com/en-us/windows/client-management/manage-device-installation-with-group-policy) and [DeviceInstallation policy semantics](https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-deviceinstallation). These support the policy choice; they do not establish that Sentinel has qualified it. Exact instance IDs are not hardware authentication. A device without a stable serial/instance identity can acquire different IDs on another port; a restart claim must be tested on the actual supported identity and port configuration. Never substitute a broad hardware-ID wildcard to hide that limit.

Only actual USB HID function subjects with fresh native topology and external connector evidence are eligible. Match their native HID descendants to select the supported input function; do not assume MI_00 universally means keyboard. Reject internal/ambiguous subjects and any parent whose descendants include a protected internal control. A composite device's storage, serial, network and other functions are not blocked by this HID-only feature.

## Durable formats, separate from temporary admission

Proposed bounded, canonical, little-endian binary formats:

* `SNTEXB01` committed state: generation u64; canonical owner SID (length <=184); sorted unique exact blocked interface IDs (0..32 total, ASCII 1..200 bytes each); canonical managed-policy digest; SHA-256 corruption checksum. Maximum encoded size 8 KiB. Raw IDs remain in protected native state and never enter browser DTOs or logs.
* `SNTEXJ01` transition: nonce (32 lowercase hex), expected generation, action (`block`/`allow`), issued UTC, rollback deadline <=300 seconds, native topology token, exact target IDs, full bounded previous committed state and candidate state, authenticated previous managed saved/effective policy representation, and checksum. Maximum 32 KiB. The deadline belongs to the **update**, never the committed block.
* Transition phases: `Prepared`, `RecoveryArmed`, `SavedCandidate`, `EffectiveCandidateVerified`, `Committed`, `Retired`. Persist phases atomically; a phase alone never proves that a subsequent GPO save occurred. Reentry must reverify saved and effective values and redo required saves.

Retain the existing native protection principles: protected administrator/SYSTEM directory and file ACLs, trusted ancestor pins, no reparses, exclusive operation lease, bounded sharing-violation retries, write-through/Flush(true), atomic replacement with readback, generation checks and a versioned checksum. A checksum is corruption detection, not caller authorization. Use separate state files and a separate task namespace; do not reinterpret `SNTENR01` approvals as blocks or extend `SNTADM01` leases.

## Proposed native API

```csharp
// Implementations are protected native code. Browser refs resolve here only.
ExactBlockSnapshot ReadCommitted();
ExactBlockRequest PrepareChange(
    string action, ExactBlockSnapshot before,
    UsbAdmissionInventory.Result freshInventory, string groupReference,
    string sessionSalt);
Task<ExactBlockResult> ApplyChange(
    ExactBlockRequest request, NativeSingleUseOwnerProof ownerProof);
ExactBlockResult RecoverPendingTransition();
ExactBlockReadback ReadVerifiedState();
```

`PrepareChange` resolves the redacted reference with shared `UsbAdmissionTabModel.Groups/Reference`. The immutable request binds owner SID, action, expected/candidate generations, target function IDs, full before/after policy digests, topology token, nonce and update deadline into the same Windows Hello proof. A renderer supplies only action/ref/topology, never IDs, owner proof, a policy blob, or an `authorized` Boolean. For Block, `after=before.Union(target)`; for Allow, `after=before.Except(target)`. Assert every non-target entry is byte-for-byte unchanged before applying.

`ExactBlockResult` has separate fields for saved-policy verification, effective-policy verification, device problem/restart state and actual input acceptance. Suggested statuses are `blocked_policy_verified`, `released_policy_verified_input_unverified`, `restart_required`, `update_recovery_pending`, `policy_drift`, and `unsupported_identity`. A healthy PnP problem code or successful restart command never means keystrokes were verified.

## Transaction and independent recovery

1. Lock the protected exact backend. Refuse another active update and incompatible/foreign managed policy. Read and pin before-state plus saved/effective baseline.
2. Build the target-only diff. Verify fresh external topology, internal exclusions, generation, deadline and real single-use Hello proof. No unrelated device enrollment occurs.
3. Durably write the full transition before any policy mutation. Install and read back a pinned SYSTEM recovery task with an update-deadline trigger, boot trigger and bounded retry. Its no-shell fixed-image action binds the nonce and journal digest. Existing named jobs and producer-quiescence rules are reusable concepts, not already compatible implementations.
4. Write the complete candidate list through the saved-GPO adapter, preserving unrelated settings. Refresh computer policy. Verify exact saved and effective values, types, list membership, ownership and unchanged unrelated digest. Recheck protected generation and target topology.
5. Atomically commit candidate generation and verify committed bytes. This is the durable decision point. A crash before it means rollback to **previous committed state**, including previous blocks; it does not mean clearing every deny entry.
6. After commit, the watchdog must recognize matching candidate generation/state/policy digest and finish verification/retirement without removing the newly committed block. A lost commit reply must not replay owner proof or roll back a valid commit. If state is corrupt or neither before nor candidate matches, retain evidence and refuse destructive cleanup.
7. Quiesce only owned producer jobs, prove current saved/effective policy matches the committed state, then retire only the exact owned transition tasks and journal. Keep the installed recovery image while any journal/task can reference it.

The boot recovery worker runs only for an incomplete transition; committed restrictions reside in saved Windows policy and have no five-minute release task. A startup observer may verify drift, but must not turn an unknown or damaged configuration into a fresh block. Foreign/MDM policy changes cause `policy_drift`, not blind deletion or adoption. If unrelated policy cannot be preserved exactly, refuse the operation.

## Release and input recovery

Allow's policy transaction commits removal of the target deny entries while preserving all other committed blocks. Any physical restart is a separate, owner-bound action restricted to the exact target function and fresh external topology. Never restart every connected input, never force a critical interface, never touch class filters or Interception as part of Allow, and never reboot automatically.

Current `UsbAdmissionDeviceRecovery` is intentionally a policy-fully-released helper. Do not reuse its `isPolicyReleased` gate unchanged when other exact blocks remain: introduce a target-release readback proving the selected IDs are absent while all unrelated committed deny entries remain intact. Its full-inventory-before-each-action approach also needs a targeted fresh validation path to avoid exhausting the 30-second budget before reaching the keyboard. Windows may require a restart to recover an input stack; that status must be visible and verified by the owner. The observed reboot-restored keyboard does not prove which old filter caused the failure.

## Migration

Before enabling this backend, require the old general admission journal to be cleared by its own authenticated recovery, owned producers/tasks quiescent, and saved/effective global USB-class restrictions absent. Preserve its historical configuration and evidence. Never import old approved external IDs as explicit blocks.

The released legacy Ducky baseline can contain `SentinelOperation`, two old deny switches and an empty `DenyInstanceIDs` key. Either retain that baseline with a reviewed ownership-aware adapter or perform a separately reviewed migration. Do not silently replace old ownership markers or share unverified numeric list entries with foreign policies. Any nonempty unknown instance deny list, unresolved task, corrupt journal or MDM-owned setting blocks migration.

## Required acceptance before integration claims

* Pure canonical format tests: truncation, oversize, duplicates, ID grammar, checksums, generation conflicts, exact non-target preservation, empty-list baseline restoration, and redacted refs.
* Fault injection after every journal/GPO/refresh/commit/cleanup boundary, including every partial value-write prefix. Before-commit faults restore previous blocks; after-commit crashes preserve the candidate. Test stale callbacks, replayed proof, clock reversal, lock contention and foreign drift.
* Private native saved/effective fixture with the actual worker, independent deadline recovery, killed producer trees, startup recovery and digest-preserved unrelated policy. A private registry fixture is not device acceptance.
* Controlled real test: Block the selected Ducky; normal mouse, external keyboard and built-ins retain their previous access. Replug Ducky and verify no harmless typing. Close Sentinel and restart Windows; repeat the actual behavior check. Record actual build/hash and user observation, not a CM code alone.
* With two explicit blocked targets, Allow one and confirm the other remains blocked across another restart. Verify target restoration separately; show restart-required honestly. No force, class-filter edits or automatic reboot.
* Review the native caller, Hello proof binding, installer/image/task ACLs, saved/effective adapter and state recovery before activation. Coordinator integration remains separate from source completion.

## Minimal clean implementation ownership

New files can isolate this work without modifying the temporary global backend:

* `tools/usb/UsbExactBlockState.cs` — canonical committed state and transition formats plus protected storage.
* `tools/usb/UsbExactBlockTransaction.cs` — generation-bound target diff and explicit commit/recovery decision.
* `tools/usb/UsbExactBlockMachineGpo.cs` — exact-instance saved/effective adapter and ownership-aware baseline restoration.
* `tools/usb/UsbExactBlockWorker.cs` — pinned update/boot recovery, producer quiescence and task retirement.
* `tools/usb/tests/UsbExactBlockStateTest.cs`, `UsbExactBlockTransactionTest.cs`, and private native qualification drivers.

Root owns the existing operator/UI/installer bridges. The next ready implementation is state+transaction with exhaustive failure tests, then the exact GPO adapter/private qualification. This draft does not claim that a persistent device block has been implemented or tested.
