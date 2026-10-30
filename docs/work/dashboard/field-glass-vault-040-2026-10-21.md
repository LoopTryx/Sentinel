# Compact picker glass and vault read failures - 2026-10-21

Owner screenshot is field-vault.html, not the large Passwords workspace. It shows runtime vault_unlock_failed then success on another attempt.

Confirmed visual root cause: color-scheme:dark on extension iframe/root painted an opaque canvas behind otherwise transparent glass. Corrected compact root/frame and larger embedded panel canvas to normal color scheme while retaining explicit dark control styles. Actual IAB synthetic patterned-page screenshot demonstrates background transmission plus blur (artifacts/field-glass-040-preview.png). Compact picker height reduced and highlights softened.

Runtime investigation: vault_unlock_failed conflated file access, invalid envelopes and key/authentication errors. readVaultDocument now retries only allowlisted transient filesystem errors with delays75/150/300ms within the same request. Exhaustion returns vault_storage_busy. Malformed JSON/envelopes return vault_invalid_file without replacement, legacy fallback or data loss. Only ENOENT permits initialization. Canonical base64, version, object shape and salt/IV/tag lengths validated before derivation. Wrong key/authentication still fails closed without retry/reset. Field UI explains these errors without exposing internal contents.

The exact owner's original intermittent error has not been reproduced or proven to be a transient read. This is not evidence that all first-attempt unlock failures are resolved; live Hello reproduction still required. No real vault decrypted/reset/read by agent. User auth guard unchanged.

Verification: 47 vault/runtime-integration/password/overlay/harness tests passed outside redirected temp isolation; 41 extension tests rerun after final styling passed. Build/dist parity passed. Malformed-document preservation and bounded storage retries reviewed independently with no remaining blocker. Installed 0.2.40 in six existing extension locations, runtime source hashes checked, startup navigation/glass/Dashboard/backend verified. Native binaries unchanged. Preview server loopback-only and stopped after verification.
