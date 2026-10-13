# Context-aware WhatsApp message checks

Engineer B, 13 October 2026. Issue #14. Branch `codex/engineer-b/issue-14-context-detector`, stacked on `df69ec0` / PR70 to preserve the owner's extension design. This extends the existing `explainMessage` API and opt-in WhatsApp observer; URL X-Ray, native transport and permissions are unchanged. Coordinator integration and independent Engineer A review remain required.

## What changed

- `apps/extension/src/local-checks.js` delegates only its message function to `message-detector.js`. Existing callers still receive `risk`, `coverage`, `reasons` and `networkAccessed`; tiers, scores, category signals, sender-context provenance, borderline status and aggregate entity observations are additive. `risk: unknown` remains the no-warning result. The displayed **Safe** tier explicitly means no combined threshold was reached, not verified safety.
- Normalization uses Unicode NFKC, lowercase, Arabic/Persian digit handling, Arabic diacritic/tatweel and invisible-control removal, emoji/punctuation removal, whitespace folding, `0/o`, `1/l`, `$/s`, `@/a` mapping and folding exaggerated runs of three or more letters. Ordinary double letters in words such as password remain intact. A separate numeric-preserving pass avoids interpreting words such as `lol` as amounts after leetspeak conversion.
- Editable category terms, n-grams/regexes, English/Arabic phrases, thresholds, caps, weights, proximity window, bonuses, shorteners, TLDs and known-brand domains live in `apps/extension/data/message-detector-config.js`. Each distinct signal contributes once, with per-category caps. Repetitions and overlapping phrases cannot inflate scores indefinitely. A minimum of **two content categories** is a nonconfigurable guard: neither a lone word, a lone link nor sender metadata alone flags.
- Bonuses cover nearby category matches, reward/action/urgency, direct code/password/money requests and unverified-link pressure. Amount and phone observations only support combinations. Link inspection parses actual hosts before text normalization, uses edit distance and detects shorteners, suspicious TLDs, brand naming, embedded credentials, IP and internationalized hosts. URL path/query/host words cannot manufacture independent prose categories. No URL is fetched or expanded; listed official domains are a naming comparison, not a safety certificate.
- Inline badges retain the red gradient, bubble outline, shadow isolation, expand/collapse and outgoing-message exclusion. They show **Suspicious** or **Likely Scam** and category explanations. Changing sender context can remove the outline while retaining neutral review controls. The manual popup also shows tiers/reasons and sender status.
- Paired desktop events retain the existing allowlisted codes through an explicit compatibility mapping. New category names do not silently break the current desktop event endpoint. No backend contract was edited.

## Sender context and privacy

The existing adapter has no reliable saved-contact API. It does **not** infer contact status from a display name or read a contact directory, sender number or previous chats. Default context is **unknown**. The warning's controls let the user identify a message as saved/unsaved, first-time, unfamiliar country code or trusted; those choices apply only to that rendered message and reset when its text is recycled. The manual checker has its own explicit status selector. These are user-provided signals, not independently verified identities or a persistent number whitelist.

Unsaved threshold: 8/16; unknown: 10/18; saved: 13/21; trusted: 17/25 (Suspicious/Likely Scam). Saved/trusted messages additionally need stronger evidence. Trust cannot suppress a direct money/code/password request: its warning threshold is capped at the saved-contact threshold. No claim of detecting a *change* in a sender's habits is made; the app warns about the request without collecting history. Country-code context contributes only one point after multiple content categories match and cannot flag by itself.

`Report wrong flag` and the popup's `Report missed scam` record bounded, tab/popup-local aggregate counts. `Download feedback counts` exports only tier/category counters. No message, phone, URL, matched text or identity enters feedback; it is not uploaded, persisted automatically or used for automatic retraining. Pausing the observer clears its counters.

Optional LLM second opinion is **disabled**, including for borderline messages. Borderline status is available to callers, but no provider/key/network path was added. The committed privacy policy prohibits live message bodies in AI prompts; this optional requirement does not override that policy. Static local explanations remain functional.

## Reproduce and tune

```powershell
cd apps/extension
node --test
node scripts/evaluate-messages.mjs
node scripts/build.mjs
node scripts/smoke.mjs
```

Edit the policy data file, rebuild and rerun both the corpus and regressions. The corpus has 80 invented, labeled messages: 40 scams / 40 legitimate, including delivery/bank/code notifications, ordinary rewards, saved-contact requests, Arabic/mixed text and obfuscation. It is divided into 40 tuning and 40 held comparison cases. Both were authored for this change; this is **not an independent blind benchmark**. The tuning pass exposed the existing cash-claim regression; numeric-pattern corrections restored it. Comparison cases were not rewritten to remove the remaining false positive.

The exact prior `explainMessage` implementation from `df69ec0` is preserved in `test/fixtures/legacy-message-detector.mjs`. The evaluation script prints IDs and counts, never bodies; full repeatable results are in `docs/evidence/context-message-results.json`.

| Synthetic set | Before false positives | After false positives | Before false negatives | After false negatives |
| --- | ---: | ---: | ---: | ---: |
| Tuning: 20 legitimate / 20 scams | 11 (55%) | 0 | 4 (20%) | 0 |
| Held comparison: 20 legitimate / 20 scams | 10 (50%) | 1 (5%) | 5 (25%) | 0 |
| All: 40 legitimate / 40 scams | 21 (52.5%) | 1 (2.5%) | 9 (22.5%) | 0 |

Remaining false positive `h15` is an anti-scam educational sentence with reward/action language after its negated money request is excluded. No blanket educational-word bypass was added, since attackers could append one to actual bait. Real conversations, dialects, quoted/forwarded text, novel brands and compromised legitimate domains can still produce false positives/negatives. Scores are not probabilities.

## Validation and delivery

- Final focused classifier/compatibility/DOM suite: 19 tests PASS, including single-category refusal, URL/prose separation, numeric versus leetspeak requests, negation, saved/trusted requests, event-code compatibility, output privacy, feedback, observer cleanup and latest-100 cap.
- Complete extension suite: 76 tests PASS; build and packaged smoke/parity PASS.
- Complete unchanged `tools/verify.ps1`: initial working-tree run PASS and final source rerun PASS (exit 0, `All available T01 checks passed`). Final source is commit `7444f2bb707917a8a9599deab0ff411f30e24c79`; this evidence-only follow-up does not alter it. Rust formatting/strict lint/workspace tests/generated bindings, TypeScript checks/UI tests/build, existing extension gate and connected demo checks all passed. The separate complete extension run covers the new test file too (76 PASS).
- Actual browser synthetic fixture: English flagged message, unflagged ordinary OTP notification, Arabic warning, expanded reasons/contact controls and one private feedback report verified. Fixture at `test/fixtures/whatsapp-preview.html`; screenshot `D:/SENTINAL/context-detector-preview.png`. No real chat, credentials, contact directory or phone numbers were inspected.
- Bounds: 4096 input characters, 12 inspected URLs, capped category matches/scores, latest 100 supported rendered bubbles, debounce and observer/timer cleanup retained. Longer/unsupported messages are not cleared as safe; coverage stays partial. Link resolution, reputation, history and identity verification are unavailable.
- `downloads/sentinel-extension-v8.zip` is an unpacked extension preview package committed directly to GitHub, **not a release**. Filename v8 is a package iteration; MV3 manifest version remains 0.2.0. All 32 packaged files were SHA-256 compared with `dist`; ZIP SHA-256: `4cddf11761d9351b890563ffb7cee1055434dabb1e287b529128e0e20f2d8dbb`. Extract and load the directory through Chrome's developer **Load unpacked**, then reload the extension and WhatsApp. Production/live-site support still requires installed-browser acceptance and peer review.

Engineer A review requested: scoring/negation and multilingual false-positive behavior, URL parsing/lookalike boundaries, sender-context honesty, feedback privacy, paired event compatibility and opt-in/lifecycle preservation. No whole #14 completion, production accuracy or verified sender identity is claimed.

## Owner UI follow-up
The owner requested Sentinel's visual language for the preview and inline warning. Navy/azure surfaces, beige text, bright red warning gradients, consistent padding/edges and the supplied mascot now replace the generic light fixture. Secondary sender/feedback controls are under a native keyboard-accessible disclosure; reasons and the essential local/privacy limitation remain visible. No scoring, context policy or event behavior changed.

Focused classifier/DOM suite12 PASS including disclosure functionality; extension build/smoke PASS; all32 ZIP entries hash-match dist. Actual browser verified warning opening by keyboard, the secondary disclosure, readable themed layout and no horizontal overflow at the default607px viewport. Screenshot D:/SENTINAL/context-detector-themed-preview.png. Full verifier evidence above applies to the prior scoring source; this presentation-only follow-up used focused checks rather than repeating native tests. The v8 package is refreshed directly in the branch, not a release.

## Final owner UI correction
The owner requested removal of the large inline panel: WhatsApp now retains only the small red tier badge and a two-line explanation on expansion. Inline sender selectors, trust checkboxes, report/export controls and the large styled report are removed. Inline checks use unknown sender context; scoring still supports explicit caller context, and manual popup sender status and feedback remain available. This supersedes the inline-control descriptions above. Detector configuration, weights, normalization, category/link analysis and corpus results are unchanged. Focused12 tests/build/smoke PASS;32 ZIP files hash-verified. Browser keyboard expansion verified the compact explanation (D:/SENTINAL/whatsapp-compact-warning.png).
