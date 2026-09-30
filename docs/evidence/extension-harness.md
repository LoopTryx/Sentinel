# Extension harness evidence — issue #2

Date: 2026-09-30 · Agent: GLM 5.3 · Branch: `glm/issue-2-extension-harness`

## What changed

- `apps/extension/src/status.js` (new): pure status model. Fixture-rule state comes from a runtime query, never a constant; agent is `unconfigured` while the manifest lacks `nativeMessaging`; scanning is `unavailable`; coverage is `fixture_only`.
- `apps/extension/src/service-worker.js`: computes status from `chrome.declarativeNetRequest.getEnabledRulesets()` on service-worker start, on install, and on every status/toggle message; persists the snapshot to `chrome.storage.local` and recomputes it on restart. Toggle path uses `updateEnabledRulesets` on the single `fixture_block` ruleset only.
- `apps/extension/src/popup.js` + `popup.html`: distinct lines for fixture rule / native agent / scanning / coverage, plus a block/allow toggle for `blocked.sentinel.invalid` with accessible labels. Status failure renders "Harness status unavailable" rather than a guess.
- `apps/extension/scripts/smoke.mjs` (new): dist/ parity gate + printed Chrome load steps and manual smoke checklist; exits non-zero on stale/missing build.
- `apps/extension/manifest.json`: added `"type": "module"` to the background worker so the pure status module can be imported and unit-tested. Permissions unchanged (`declarativeNetRequest`, `storage`); no `host_permissions`, no `nativeMessaging`.
- `apps/extension/test/status.test.mjs` (new), `test/harness.test.mjs` (extended): 15 tests total, including a guard that popup wording can never claim protection/connected/safe and a manifest guard pinning minimal permissions.

## Automated evidence (executed on the development machine, 2026-09-30)

- `node --check` on `src/service-worker.js`, `src/popup.js`, `src/status.js`, `scripts/smoke.mjs`: pass.
- `node --test` in `apps/extension`: 15 pass, 0 fail.
- `node scripts/build.mjs` then `node scripts/smoke.mjs`: dist parity pass, checklist printed.
- `tools/verify.ps1` was not run end to end on this machine (Rust/pnpm toolchain portions are outside this issue's changes); the extension checks it wraps were run directly as listed above.

## Manual evidence (requires real Chrome — pending owner execution)

The checklist in `apps/extension/README.md` (steps 3–7: load unpacked, block/allow behaviour on `blocked.sentinel.invalid`, service-worker restart truthfulness) has not yet been executed and recorded by the owner. Until then the harness is verified by automated checks only; it is not a working Web Shield and no live-browser claim is made.

## Remaining gaps

All limits listed in `apps/extension/README.md` remain true: no native host, no feed, no URL classification, no download scanning, no interstitial, one reserved test domain only.
