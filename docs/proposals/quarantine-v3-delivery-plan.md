# Quarantine Vault delivery plan for v3

Status on17 October2026: existing Rust candidate plus deliberately disabled desktop entry. This is a concrete plan, not permission to remove valuable files or enable an unreviewed native endpoint.

## Existing foundation

- sentinel-av vault uses AES-256-GCM encrypted blobs and encrypted/authenticated recovery bookkeeping, bounded reads (8MiB plaintext), private-storage/retained-handle checks, source identity/full-byte revalidation and exclusive restore destination creation.
- Job-bound quarantine and receipt-bound restore controllers exist with fresh native confirmation, expiry/replay/caller checks and distinct original_retained/recovery-required states.
- GlassConsole has quarantine.request and restore.request paths and a native confirmation implementation. New quarantine is explicitly refused with quarantine_recovery_lifetime_unavailable. Current display-path/restore associations and runtime outstanding actions are session-bound. A normal app shutdown would retire those authorities; merely enabling the button risks leaving no usable restore path.
- QuarantineView has the final owner UI but no durable live inventory; Restore/Destroy remain disabled. Do not interpret an unavailable inventory as an empty vault.

## Ordered implementation slices

1. Durable recovery and read-only inventory first. Reopen the same protected store/key after process exit; use authenticated records as the source of truth, not renderer or in-memory path maps. Add bounded catalogue enumeration/pagination and reconciliation for encrypted blob, quarantine journal and lifecycle receipt. Inventory returns opaque item refs, sanitized display name, detection summary, timestamp and explicit action/recovery state. Keep full paths, bytes and keys native. Missing/corrupt key, tampered journal, unsupported storage or unknown blobs must refuse mutation and retain recovery material. Review account/service ownership and key backup/recovery policy before a storage-format change; never silently create a replacement key.

2. Native quarantine transaction. Extend the existing authenticated bridge and contracts with explicit closed DTOs. A current eligible full-file report resolves to a privately retained subject. Native confirmation shows the actual intended source and implications. Revalidate identity/hash immediately before mutation. Commit and verify encrypted bytes plus authenticated recovery intent durably before removing the original through the retained subject. Only a verified terminal receipt yields quarantined. Original-retained/partial/error stays visible and cannot silently retry. Keep automatic quarantine off initially and respect the existing8MiB support limit.

3. Connect the current scan report and Vault UI. Add a real Quarantine action only for native-eligible reports. Populate the existing File/Detection/Added rows from authenticated inventory; reuse existing filters and selection. UI refetches after receipts and after refresh/restart. An unavailable or recovery-required store does not enable actions. Show precise results and retain scan evidence; no layout redesign.

4. Receipt-bound Restore and Destroy. Fresh native confirmation per selected item; derive source and destination authority natively. Restore to the verified original location or an explicit native-picker alternative, never overwrite an occupied target, never execute restored content, and preserve recovery material on write/flush/cleanup failure. Destroy removes only the selected authenticated blob/receipt after explicit irreversible confirmation. Do not delete the shared vault key or introduce automatic purge. Serialize conflicting operations and revalidate stale selections.

5. Acceptance and independent security review. Use harmless temporary files only: exact bytes after quarantine/relaunch/restore, occupied destination, source swap, link/junction/reparse change, missing/corrupt key, altered ciphertext/journal, disk-full/write/flush interruption, replay/foreign caller, parallel attempts, crash before/after original removal and startup reconciliation. Verify native dialogs, UI errors and real close/reopen. Host/private-storage CI discrepancies must be understood; do not skip guards to make checks green. Only after those proofs remove the explicit new-quarantine gate. Valuable files and live malware remain out of tests.

## Ownership and next deliverable

Propose a separately claimed native/runtime/contract slice for durable read-only inventory and restart recovery, reviewed by Engineer A. Exact source areas: sentinel-av vault/quarantine_journal/storage authority; selected-job native controllers; canonical sentinel-proto inventory/action contracts and generated bindings; demo native worker/service and GlassConsole; existing QuarantineView and tests. Enumerate the current controller/worker ownership in the claim before edits. A reviewer must check authorization and crash recovery, not only UI screenshots. No schedule or completion percentage is inferred from existing source volume.
