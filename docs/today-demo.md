# Connected school demo — 6 October 2026

This candidate preserves GLM's glass console and adds a separate, explicitly labeled demo runtime. It is not completion of the expanded S1 security product or reviewed native-messaging/vault implementation. ClamAV 1.5.4 is the selected demo engine; the temporary Defender provider was removed at the owner's clarification.

## Launch

1. Run `pnpm --filter @sentinel/ui build` and `node apps/extension/scripts/build.mjs`.
2. Build `apps/desktop/build-console.ps1 -WebView2SdkPath <official SDK folder>`.
3. Run `tools/launch-demo.ps1` in PowerShell 7. It opens the real desktop window, starts an ephemeral loopback runtime and gracefully cancels/reaps its owned scan process when the window closes. A workspace-specific mutex refuses duplicate launcher instances.
4. Load or reload `apps/extension/dist` as an unpacked Chrome extension. In its Connection controls, copy its extension ID.
5. In desktop Logs & Activity, enter that exact ID and Create companion pairing. Enter the displayed port/key in extension Connection controls, then Pair local demo. The browser asks for optional localhost access. Automatic navigation warnings have a separate, explicit HTTP/HTTPS site-access opt-in.

Pairing expires when the runtime exits or is paired again. Browser storage is session-only. Config/bootstrap files and build outputs are ignored by Git. The bearer bridge is suitable for these invented records, not a reviewed authorization design for valuable credentials. It grants dummy account operations and bounded reason-code events; browser clients cannot select files or read desktop scan details.

## Five-minute route

- Desktop Passwords: four fictional .test accounts. Orbit Mail has a common weak password; School Portal and Arcade share a predictable password. Health and reuse counts are computed from actual in-memory records. Unlock demo vault, inspect recommendations, then Generate & save demo replacement. The audit changes in both clients. Reveals are explicit and clear on locking/state change.
- Desktop Scan: choose `apps/demo-runtime/samples/02-marker.txt`. Reads/hash evidence and harmless marker detection are real. ClamAV receives the exact read snapshot through stdin only after its SHA-256 matches the checked-in harmless sample allowlist. Choose the samples folder to show three real files and two synthetic markers. Real ClamAV matches are separately labeled; they demonstrate custom signatures, not malware efficacy. The installed executable's SHA-256 is pinned. Official main/daily databases downloaded and passed FreshClam checks. The demo loads daily.cvd (355,726 signatures, version 28145) alongside the demo HDB; main.cvd is excluded because its measured cold-load exceeded the 15-second provider budget. Unknown bytes do not enter ClamAV pending hostile-parser review.
- Extension Link X-Ray: in Chrome's address bar type `sentinel`, press Tab, enter `http://bit.ly/prize-payment`, press Enter. Shows the local warning screen before visiting the destination. Desktop activity receives only reason codes when paired. Raw URLs remain in bounded, expiring session slots and are consumed by the report.
- Extension Scam messages: use `URGENT: send money to claim your prize at http://example.test`. Shows local reasons and records redacted activity. This is on-demand; WhatsApp monitoring is not implemented here.
- Extension Passwords: same invented account state. Locking or replacing through either client affects the other. Close desktop to show disconnected state rather than a made-up protection claim.

## Contracts and limits

Rust source `crates/sentinel-proto/src/demo.rs` generates the DemoState/Account/Event/Scan/File/Finding TypeScript DTOs. `apps/ui/src/demo-bridge.ts` exposes `demoCall(method,data)` and `useDemoState()`. Native calls are accepted only from the bundled exact console URL, never a foreign page.

Desktop methods: `state`, `lock`, `unlock`, `reveal/rotate {id}`, `pair {extensionId}`, `scan.select {kind: file|folder}`, `cancel`. Selection is through the native picker. Extension transport accepts only its own popup sender and `state`, `lock`, `unlock`, `reveal/rotate {id}`, `event {risk,codes}`. Event examples: `{risk:"suspicious",codes:["http","shortened"]}`. Responses: shared redacted DemoState, `{ok:true}`, explicit `{password,mode:"synthetic_demo"}`, or fixed `{error}`. No raw URL/message/password input is accepted by event ingestion.

Scans: 8 MiB/file, 64 files, 256 traversal entries, four levels, cooperative 90 seconds. No percentage is fabricated. Symlinks/oversized files are skipped; skipped/error/provider-unsupported items make completion partial. File identity/size/mtime checks detect changes during byte reads. This is not hostile-parser isolation. ClamAV runs without a shell or remediation flags, with bytecode and document/archive/image/executable parsers disabled. Provider wait is capped at 30 seconds and 32 KiB output; cancellation kills and reaps this owned child. Exit 0 means no detection, exit 1 is matched signature (known demo name is labeled synthetic; other matches are signature alerts), exit 2/other is engine error. E:, UNC and device-namespace selections are refused.

No actual website password changes, credential export/import, encrypted persistent vault, autofill, cloud explanations or downloaded-file monitoring are implemented in this candidate. The existing test-only blocked.sentinel.invalid rule remains test-only. Defender is not disabled, no malware/EICAR is introduced, and CRYPTIC E: is not accessed.

## Navigation warning candidate — 6 October

GLM PR #41 at `2566517` supplies the reference dashboard, liquid-glass sidebar and local Inter/Roboto fonts. Those presentation files are adopted in the owned demo branch; connected scan/vault state and custom desktop controls are preserved. This is not a merge of PR #41 or proof that its separate native scan adapter is reviewed.

The warning screen now distinguishes suspicious wording, a reported risk-list match and unknown safety. It uses a pinned 500-domain subset of uBlock Origin's maintained **Badware risks** list, source commit `604680a20ff3a360cc642dbf700c9d8fcab9b218`. Original source and GPL-3.0 license are bundled under `apps/extension/third-party`; the generated snapshot records capture date and source SHA-256. Only exact domain-only `$doc` rules are supported; exceptions, complex filters and path rules are not generalized. This is reported badware risk, not a claim that every listed site currently serves malware. No listed destination was fetched to create this snapshot.

`assessNavigation(url)` returns the local assessment plus `kind: listed|keywords|unknown`, `listState: current|stale|clock_anomaly|unavailable`, source and date. Snapshot age over five days is stale; no-match never becomes safe. The pure keyword rule matches separated reward and payment tokens in either order, excludes queries/fragments and avoids substring false positives such as `rewarding-coffee`. Encoded-token bypasses and shortened final destinations remain partial coverage.

Ordinary Enter presses and clicked links can be redirected before destination load by Chrome DNR, after explicit **Enable automatic URL warnings** and site-access permission. Only top-level requests are matched. Rule 9001 matches risk-listed domains/subdomains; rules 9002 and 9003 match paired bait tokens in either order. Redirects carry only a fixed classification to `warning.html`; no raw original URL is retained or exposed. The warning has no bypass. Pausing removes only these three rules. Chrome regex support and actual permission are checked; toggles are serialized and state reads actual rules. Hostile/content-script callers cannot change these settings.

Acceptance: reload the unpacked folder; enable warnings through Chrome's own prompt; enter `https://example.test/prize-payment` normally and expect the warning before any DNS-dependent destination load. `https://example.test/rewarding-coffee` must not match the keyword rule. Test actual list matching through the `sentinel` keyword report without opening a live listed site. Validate rule activation and matching in Chrome before claiming automatic interception works on this machine.

Automatic redirect logging, tab-bound release and original-destination continuation remain pending. The separate address-bar report can log reason codes to the paired desktop; its sender is authorized for `event` only and cannot request vault actions. A direct visit to the public warning page is not trusted browser-event evidence.

Fresh automated evidence: repository verifier passed after the candidate was built; independent review found substring and reverse-order keyword issues, both reproduced and fixed with regression tests. Additional permission-refusal/rule-ownership tests pass. Previous installed-Chrome keyword journey succeeded before this warning redesign; the redesigned screen and ordinary-navigation permission activation require fresh browser evidence. No release tag or installer is created by this increment.

## Observed verification

- Real loopback runtime and extension-transport tests: computed audits, edits, redacted events, rejected website/content-script callers, scan authority separation, key revocation and protected namespace rejection.
- UI component test: weak/reuse recommendations render and a revealed invented password disappears on lock.
- Initial Defender probe on a harmless file succeeded; that adapter was replaced, not retained as an automatic fallback. Real ClamAV probes produced no-detection on the clean control and synthetic-match on both demo fixtures. Official FreshClam main/daily database tests passed.
- GLM glass console build and native smoke: passed outside the execution sandbox. Native launch now records `backend=demo_runtime` only after an authenticated state probe succeeds. Actual desktop screenshot showed a selected-file result and connected scan controls. Sandbox launch timed out and is not counted as success.
- Installed Chrome companion cgaolbnpegklhpcmooegjbbjmjlfoefp loaded and paired after owner accepted localhost access. Its actual URL X-Ray invocation delivered http/shortened/reward_payment reason codes to desktop history; raw URL was absent. Final runtime was re-paired successfully. In installed Chrome, Unlock demo vault then Generate & save demo replacement on School Portal changed its audit from Weak/REUSED to Stronger, revision 1. Actual desktop UI changed to two weak / zero reused; browser-origin edit event was recorded. A desktop lock request then disabled browser reveal/replace controls. No real website password was changed. The installed Scam clues example produced pressure/payment/reward/link explanations and the same redacted codes appeared in desktop history. Full event rehearsal remains unverified.

A real three-file folder run initially hit two 15-second ClamAV startup limits and reported partial results honestly. An idle single-marker runtime run completed with the real ClamAV synthetic signature match, 94 bytes read and zero errors/skips. Provider startup budget is now 30 seconds, folder budget 90 seconds; the verified-build folder rerun completed with three files / 263 bytes / zero skipped / zero errors, one provider no-detection and two provider synthetic matches, visible in the actual glass Scan & Detect UI. Main remains excluded.

Coordinator/GLM: review mixed presentation changes and integrate through existing gates. Do not close whole S1 issues on this demo prerequisite alone.


### WhatsApp inline warning increment (7 October 2026)

Connection & test controls has a separate **Enable WhatsApp warnings** toggle. It requests optional `scripting` and `https://web.whatsapp.com/*` access only on the owner's click, registers an isolated content script for top-level WhatsApp Web, and attaches to already-open matching tabs. Pause unregisters future injections and removes current badges/observers. Failed tab attachment is visibly reported with a reload instruction.

`whatsAppStatus(api)` returns actual registered-script/permission state; `setWhatsAppWarnings(api, enabled)` returns `{ enabled, unavailableTabs }`. Worker status/toggle requests accept only the exact own popup; content status accepts only own-extension top-level WhatsApp senders. Content scripts cannot access desktop/vault operations. `mountWhatsAppWarnings(document)` returns `refresh()` and `stop()`.

Supported DOM is `.message-in [data-pre-plain-text]` containing `.selectable-text`. Only the latest 100 currently rendered incoming bubbles and messages up to 4096 characters are assessed with the authoritative local message rules. No chat scrolling, contact/phone extraction, persistence, message upload or AI calls. Unsupported DOM layouts may receive no badge; a lack of badge is not a safety verdict. A red Potential scam badge opens local reasons in a keyboard-accessible panel. Motion follows the reduced-motion setting.

Evidence: 56 extension unit tests passed. The real Chromium regression script `apps/extension/scripts/check-navigation-chromium.mjs` passed actual DNR registration, both keyword orders/uppercase redirects, and pause cleanup. Its synthetic WhatsApp DOM passed incoming-only badge, explanation, changed-message removal and pause cleanup. This fixture is NOT evidence of live WhatsApp compatibility. Owner's installed Chrome displayed automatic URL warnings enabled before this increment. Live WhatsApp and installed-browser navigation journeys still require observation.

Run the browser regression with installed Playwright/Chromium paths in `SENTINEL_PLAYWRIGHT_MODULE` and `SENTINEL_CHROMIUM_EXE`; the script uses a disposable profile, fixture-only host/scripting grants, and never attaches to the owner's profile.

Review follow-up: opt-out invalidates pending bootstraps before asynchronous imports; a second status check gates mounting. Opt-out persists before cleanup; permission removal queues shutdown, and current injected scripts recheck capability every three seconds without transmitting message content. 57/57 extension tests and the real Chromium fixture passed after these fixes. Installed live WhatsApp remains unverified.

### Installed-browser acceptance update — 7 October 2026

Owner enabled WhatsApp warnings. The installed Chrome companion `cgaolbnpegklhpcmooegjbbjmjlfoefp` displayed both "Pause WhatsApp warnings" / "Enabled for supported incoming WhatsApp Web messages. Local checks only." and automatic navigation enabled with the 500-domain snapshot. On a normal new tab, entering `https://harmless.test/prize-payment` and pressing Return redirected to the extension's `warning.html#keywords`, with "This site may be harmful" and the reward/payment explanation. No listed live destination was visited. This verifies the installed keyword interception journey, not all list rules or arbitrary shortener destinations.

Final extension suite: 60/60 passed. The disposable actual Chromium regression passed navigation registration, both keyword orders/uppercase redirects, pause removal, and synthetic WhatsApp incoming-only badge/details/edited-message/pause behavior. Independent review confirmed both original lifecycle P1 findings and the residual reinjection P2 addressed; focused WhatsApp regressions 7/7 passed.

Live WhatsApp opt-in is observed, but live incoming badge acceptance is still pending: the open WhatsApp surface had no chat selected. The owner's self-chat outgoing sample is excluded by design. An incoming harmless test message is needed; do not manufacture live incoming evidence or publish unrelated chat data. Desktop was disconnected during these observations, so this run does not establish desktop event connectivity.

Live WhatsApp acceptance follow-up: the initial incoming test did not show a badge. Inspector observation of the selected invented prize test revealed current WhatsApp DOM uses `data-testid="msg-container"` and explicit `tail-in` markers instead of the legacy `message-in` class. A synthetic fixture reproducing this structure failed first (badge timeout); the adapter was updated to require `tail-in` and reject `tail-out` for this layout, while retaining legacy incoming support. Tail-less or ambiguous current-layout bubbles remain unsupported. After rebuilding, reloading the installed extension and WhatsApp, the actual incoming invented prize message showed the red Potential scam badge. Clicking it exposed the local reward-bait explanation. This is observed live incoming compatibility for that tested layout, not all WhatsApp versions or grouped/tail-less bubbles. No raw chats or sender identifiers are published.

Final selector review: attribute-only `tail-in` -> `tail-out` changes initially left the badge attached. A failing-first actual Chromium fixture reproduced it. The observer now watches bounded relevant `data-testid`/`class` changes, and the fixture passes badge removal/reappearance across direction flips. Final repository verifier was rerun after this change.

### Second-chat cash-offer fix — 7 October 2026

Owner reported the warning worked in one test chat but not another. The invented second-chat samples used "price" instead of "prize". Added a contextual cash-claim pattern requiring claim + price/cash/money/reward + a currency amount; ordinary price/receipt/purchase discussion remains unknown in negative tests. Failing-first unit test then passed.

Consecutive current-layout bubbles may omit tail-in. Supported msg-container text with no confirmed direction now shows **Suspicious wording**, explicitly explaining that message direction is unavailable and the check does not identify the sender. Confirmed outgoing tail/receipt markers and legacy message-out remain excluded. This supersedes the previous incoming-only/tail-less-unsupported description: the latest 100 supported rendered text bubbles are locally checked, with known incoming versus unknown direction visibly distinguished. No contact metadata, raw content persistence or upload is added. Missing badges still do not establish safety.

Actual Chromium fixtures failed before unknown-direction support, then passed badge/details, outgoing exclusion, attribute-only receipt/direction transitions, message correction, and pause cleanup. Observer watches data-testid, data-icon and class changes. All 61 extension tests and full tools/verify.ps1 passed after the final changes.

Installed Chrome retest initially showed WhatsApp warnings off after reload. Restoring the already-owner-approved toggle showed enabled local checks. The actual second chat then displayed Suspicious wording and Potential scam buttons on the invented cash tests. The earlier shared screenshot embedded in a chat message is not counted as extension evidence. No private sender identifiers or unrelated chat contents are published. Latest local explanation click was interrupted by detected user input; actual local reasons remain covered by the browser fixture and prior live first-chat check.
