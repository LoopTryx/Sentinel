# Sentinel Browser Companion

An installable Chrome Manifest V3 extension with a toolbar popup and full-tab Y2K Cyber Console dashboard.

## Working features

- Inspect a manually entered HTTP/HTTPS URL locally: actual destination, embedded credentials, unencrypted HTTP, IP addresses, internationalized names and nondefault ports.
- Inspect the current HTTP/HTTPS tab from the extension toolbar after a user gesture.
- Explain urgency, secret requests, payment, reward and insecure/shortened-link clues in invented message examples.
- Clear local inputs. Raw inputs are neither persisted nor uploaded.
- Toggle and verify the real Chrome DNR rule for the single reserved fixture domain `blocked.sentinel.invalid`.

No clue is a malware verdict or a guarantee of safety. Results have partial coverage; a URL without clues remains unknown. There is no native connection, password vault, download interception, automatic mail/WhatsApp monitoring, reputation feed or file-byte scanning in this increment.

## Build and install in Chrome

From the repository root:

```powershell
node apps/extension/scripts/build.mjs
node apps/extension/scripts/smoke.mjs
node --test apps/extension/test/*.test.mjs
```

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Click **Load unpacked** and select the absolute `apps/extension/dist` directory.
3. Open Chrome's extensions menu, pin **Sentinel Browser Companion**, then click its toolbar icon.
4. Click **Open dashboard** for the full-tab console. Current-tab inspection is intended for the toolbar popup on an HTTP/HTTPS page; the dashboard itself is an extension page and reports this limitation.

For the supplied ZIP, extract it first and select the extracted directory containing `manifest.json`. This is a developer-loaded extension, not a Chrome Web Store publication.

## Permissions

| Permission | Purpose |
| --- | --- |
| `activeTab` | Read the active URL only after opening the toolbar extension on that tab. |
| `declarativeNetRequest` | Toggle and verify the packaged reserved-domain test rule. |
| `storage` | Persist harness installation/status metadata; live ruleset status is recomputed. Local tool inputs are never stored. |

There are no host permissions, content scripts, native messaging, downloads, or broad `tabs` permission. Inputs stay in the current extension document until cleared or closed; do not use real secrets in examples.

## Chrome verification

See [real Chrome evidence](../../docs/evidence/chrome-extension-local-tools.md). The rule blocks only a synthetic domain and does not protect other browsing. The unit tests also cover unavailable browser APIs and service-worker failure states.
