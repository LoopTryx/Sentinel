# Vault recovery, autofill compatibility and presentation scale - 2026-10-21

Owner reported a persistent vault-key mismatch, blank space in compact autofill, broad website compatibility, green no-indicator results, and small fullscreen console controls.

Read-only real-file metadata confirmed final and pending Windows-protected key files coexist. No real key/ciphertext was decrypted or altered by tools. Native UnlockKnownKeys now tries final, then pending only on exact authentication failure after bounded backoff, inside the same existing Hello approval/lease. Successful pending unlock atomically replaces final with a unique previous-key backup. Both failure paths preserve all keys and vault data. Synthetic DPAPI success/failure byte-preservation tests passed; independent review found no blocker. Actual pending-key compatibility must be verified by the user's next Hello approval; recovery is not guaranteed if both keys mismatch.

Compact picker uses content bounding height and removes minimum-height reservation. Password-field detection and exact-bound filling now support open shadow roots and text inputs explicitly marked current-password/new-password, retaining HTTPS, top-frame, origin, document and field checks. Dynamic shadow input test passes. Closed shadow roots, embedded frames, browser-owned fields and arbitrary nonstandard widgets are not universal coverage. No automatic submit added.

Finished, noncancelled, fully inspected no-indicator reports with a full hash turn green, including the console backdrop. Partial/error/stale reports remain neutral/warning. Shared-vault account data and scan caveat retained. UI test verifies complete and partial eligibility and green state.

The complete console scales uniformly with window dimensions from 1x at 1366x768 up to 2x at large presentation sizes. Viewport compensation and sidebar sizing retain scrolling; narrow/short windows remain 1x. Scale and scan/UI tests pass. Current evidence is build/tests/native startup, not projector or fullscreen screenshot acceptance.

Verification: 30 focused password-extension tests; 10 focused UI tests; C# console/native builds and synthetic DPAPI recovery harness passed; UI build and extension parity smoke passed. Installed 0.2.41 in six extension locations with hash checks, native/UI hashes matched. Installed Sentinel relaunched with navigation=True, glass=true, heading=Dashboard. No installer or real malware/USB actions.
