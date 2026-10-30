# Quarantine integration in the v3 branch

Manual quarantine is connected to the existing Scan & Detect and Quarantine views. A current, complete single-file report with suspicious/signature evidence enables the action after the protected store preflight succeeds. The native host shows a confirmation and resolves the selected source privately. Only a successful encrypted-store/removal receipt displays Quarantined. Original-retained and recovery failures remain distinct.

The existing AES-GCM vault, authenticated journals, source identity checks and exclusive destination creation are reused. The worker now supports bounded durable inventory and native-parent restore/destroy sessions. Inventory exposes opaque references, sanitized names, sizes, hashes, timestamps and action states. Original paths remain native. Missing keys are never replaced during recovery. Restore validates the authenticated digest and never overwrites an occupied destination. Destroy requires a fresh native confirmation and a committed verified item. Actions expire after 30 seconds and revalidate inventory before mutation.

Starting a new scan or closing the app no longer discards access to stored items. Fresh-process recovery includes interrupted quarantine records. Unknown or damaged storage refuses mutation and retains recovery material.

Validation uses invented harmless files only:

- Rust workspace formatting, lint and tests, including six stored-quarantine regressions covering restart, declined actions, occupied destination, substituted encrypted blob, explicit destroy, missing key/tampered journal and interrupted quarantine recovery.
- Native DTO boundary harness: closed fields, exact references, path redaction, bounds and recovery action gates.
- Three native runtime tests: real byte scan, browser/native authorization separation, missing worker, and quarantine followed by another scan, runtime shutdown and fresh-process restore with exact original bytes.
- UI tests cover inventory validation, native action references, failure states, eligible scan actions and duplicate action prevention.

Scope: manually selected single files, at most 8 MiB each, existing bounded vault limits. Automatic quarantine and folder-wide remediation are not implemented. The vault does not execute restored files. Deleting an encrypted copy is not a secure-erasure guarantee. Old unrelated GLM vault formats are not migrated. Detection reasons remain in scan evidence; the durable inventory records lifecycle state.

Independent authority/crash-recovery review and actual native confirmation-dialog acceptance are still required before release. Local tests do not establish production antivirus protection or privileged worker isolation.

Final local results: tools/verify.ps1 passed, including 28 UI test files / 59 tests and production UI build. The installed-ClamAV provider test was explicitly skipped because that provider is unavailable. The three native runtime tests and StoredQuarantineBoundaryTest passed. The native console build and tools/launch-demo.ps1 -Smoke passed (navigation=True, glass=true, custom_chrome=True). The updated inspection executable was staged with tools/stage-inspection-engine.ps1. Windows retained-handle tests require normal filesystem access; the sandboxed attempt failed on ancestry access and the normal-access run passed without weakening guards.
