# Extension harness evidence — issue #2

Date: 2026-09-30 · Agent: GLM 5.3 · Branch: `glm/issue-2-extension-harness`

## What changed

- `apps/extension/src/status.js` (new): pure status model. Fixture-rule state comes from a runtime query, never a constant; agent is `unconfigured` while the manifest lacks `nativeMessaging`; scanning is `unavailable`; coverage is `fixture_only`.
- `apps/extension/src/service-worker.js`: computes status from `chrome.declarativeNetRequest.getEnabledRulesets()` on service-worker start, on install, and on every status/toggle message; persists the snapshot to `chrome.storage.local` and recomputes it on restart (the snapshot is write-only diagnostics — the worker never reads it back as truth). Toggle path uses `updateEnabledRulesets` on the single `fixture_block` ruleset only, validates the toggle input is a boolean, and serializes concurrent toggles through a chained queue with a final-state re-read.
- `apps/extension/src/popup.js` + `popup.html`: distinct lines for fixture rule / native agent / scanning / coverage, plus a block/allow toggle for `blocked.sentinel.invalid` with accessible labels. Status failure renders "Harness status unavailable" rather than a guess.
- `apps/extension/scripts/smoke.mjs` (new): dist/ parity gate + printed Chrome load steps and manual smoke checklist; exits non-zero on stale/missing build.
- `apps/extension/manifest.json`: added `"type": "module"` to the background worker so the pure status module can be imported and unit-tested. Permissions unchanged (`declarativeNetRequest`, `storage`); no `host_permissions`, no `nativeMessaging`.
- `apps/extension/test/status.test.mjs` (new), `test/harness.test.mjs` (extended), `test/worker.test.mjs` (new), `test/parity.test.mjs` (new): 32 tests total, including a guard that popup wording can never claim protection/connected/safe, a manifest guard pinning minimal permissions, a stale-snapshot test proving a failed runtime query reports `unknown` even when a persisted snapshot claims `active`, source guards for restart recompute, toggle-input validation, and toggle serialization, plus tests that execute the real service-worker module under a mocked Chrome surface and negative dist-parity fixtures.

## Review feedback applied (Codex, via chat.md)

Round 1 (Codex msg 2):

- Failed Chrome API calls now provably yield `unknown` states instead of reusing persisted active status (stale-snapshot test + worker never reads `storage.local.get`).
- Message/toggle inputs are validated (sender allowlist, strict kinds, boolean toggle).
- Concurrent toggles are serialized and each run re-reads the final ruleset state.
- Manual Chrome evidence stays a separate pending section below, apart from automated and dist-parity evidence.

Round 2 (Codex msg 4/5, both P2 findings reproduced by the reviewer):

- **P2 diagnostic storage failure** (fixed): the storage write is best-effort (caught and warned); `respondWithStatus` settles every accepted request exactly once, answering a valid status or a `null` status the popup renders as "Harness status unavailable"; startup and install paths catch their own failures. `test/worker.test.mjs` executes the actual worker module under a mocked Chrome surface and proves exactly-once answers including rejecting storage, foreign-sender and invalid-input no-mutation, rejected-update-then-fresh-query reporting the actual unchanged state, ordered queued toggles that survive failure, and restart recompute that ignores stale stored state — all with bounded waits.
- **P2 parity gate skipped runtime scripts** (fixed): `scripts/smoke.mjs` now content-compares `dist/src/service-worker.js` and `dist/src/popup.js` against source alongside the other files. `test/parity.test.mjs` builds an isolated temporary fixture (developer `dist/` untouched), tampers each runtime script independently, and requires a non-zero smoke exit with the offending file named.
- Minor: README evidence link corrected to `../../docs/evidence/extension-harness.md`; test counts in this doc and STATUS.md refreshed.

## Automated evidence (executed on the development machine, 2026-09-30)

- `node --check` on `src/service-worker.js`, `src/popup.js`, `src/status.js`, `scripts/smoke.mjs`: pass.
- `node --test` in `apps/extension`: 32 pass, 0 fail (status/harness unit tests, worker execution tests under Chrome API mocks (install listener, query rejection, null fallback), and parity fixtures).
- `node scripts/build.mjs` then `node scripts/smoke.mjs`: dist parity pass, checklist printed.
- `tools/verify.ps1` was not run end to end on this machine (Rust/pnpm toolchain portions are outside this issue's changes); Codex ran the full verifier against head `0d77957` successfully during review, and CI runs it on the PR.

## Manual evidence (requires real Chrome — pending owner execution)

The checklist in `apps/extension/README.md` (steps 3–7: load unpacked, block/allow behaviour on `blocked.sentinel.invalid`, service-worker restart truthfulness) has not yet been executed and recorded by the owner. Until then the harness is verified by automated checks only; it is not a working Web Shield and no live-browser claim is made.

## Remaining gaps

All limits listed in `apps/extension/README.md` remain true: no native host, no feed, no URL classification, no download scanning, no interstitial, one reserved test domain only.
