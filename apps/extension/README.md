# Chrome extension harness

This unpacked Manifest V3 extension tests the browser boundary with one synthetic domain. It can block or allow top-level navigation to `blocked.sentinel.invalid` (a reserved `.invalid` domain that cannot host a real website) using a packaged Chrome DNR rule. No real threat feed, content script, native host, download scanning, or vault access is enabled.

The popup reports only states the extension can observe at runtime. It is not a Web Shield and never reports one.

## Developer load and smoke flow

From the repository root:

```powershell
node apps/extension/scripts/build.mjs
node apps/extension/scripts/smoke.mjs   # verifies dist/ parity, prints the checklist
```

Then in Chrome:

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `apps/extension/dist`.
3. Open the popup. Expected: *Fixture rule active*, plus *Native agent* and *Scanning* lines marked unavailable and a *Coverage* line reading *synthetic fixture only*.
4. Visit `http://blocked.sentinel.invalid/`. Expected: Chrome's `ERR_BLOCKED_BY_CLIENT` block page.
5. Open the popup, choose **Allow test domain**, then reload the page. Expected: the request fails to resolve (`.invalid` never resolves). This is the expected allow behaviour, not an error.
6. Choose **Block test domain** again. The popup must report the rule active on its next check.
7. Restart the service worker (close the popup, then on `chrome://extensions` click **service worker** to inspect, or wait for suspension). After any restart the popup must still report the *live* ruleset state — the stored snapshot is recomputed from the browser, never replayed as truth.
8. Unload the extension when the harness exercise is finished.

`smoke.mjs` exits non-zero when `dist/` is missing or stale, so this flow is repeatable and CI-checkable. Steps 3–7 are manual because they need real Chrome; record any deviation in `docs/evidence/extension-harness.md`.

## What each state means

| Popup line | States | Meaning |
| --- | --- | --- |
| Fixture rule | `active` / `disabled` / `unknown` | Verified against `chrome.declarativeNetRequest.getEnabledRulesets()` on every popup open and service-worker start. `unknown` means the browser query failed; it is never reported as active. |
| Native agent | `unconfigured` | This harness stage requests no `nativeMessaging` permission and registers no host, so no agent connection can exist. `unavailable`/`connected` states are defined in `src/status.js` for later stages. |
| Scanning | `unavailable` | Page and download scanning require a connected native agent. No scan result is ever shown in this stage. |
| Coverage | `fixture_only` | The only enforced rule targets `blocked.sentinel.invalid`. This is not threat protection. |

## Permissions and why each exists

| Permission | Justification |
| --- | --- |
| `declarativeNetRequest` | Enables/disables the packaged synthetic block ruleset and reads which rulesets are enabled so the popup reports verified state instead of assumptions. |
| `storage` | Persists the harness install timestamp and the last status snapshot for service-worker restart persistence; the snapshot is recomputed on every start. |

Deliberately absent: `host_permissions` (no page content is read), `nativeMessaging` (no native host exists in this stage), `tabs`, `webNavigation`, `downloads` (no behaviour requires them). Any future permission must land together with its justification here and in the PR description.

## Remaining gaps (unchanged truthfulness)

- Not connected to the Sentinel agent; no native messaging host exists yet.
- No real feed, no URL classification, no download scanning, no offline interstitial, no expiring exceptions.
- The block/allow toggle covers exactly one reserved test domain.
- Manual Chrome smoke steps (3–7 above) have not been executed by the owner yet; see [evidence](../docs/evidence/extension-harness.md).

Next stages: local URL verdict protocol; native host with exact extension ID allowlist and bounded framing; offline interstitial and expiring exceptions; completed-download handoff; then live browser restart, hostile-message, and rule-capacity checks.
