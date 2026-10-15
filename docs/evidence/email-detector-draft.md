# Email detector draft — Engineer B, 14 October 2026

Issue #14; owner collection branch `prattyush-changes-for-v3`; PR75. Base: `55b7bb958f1af891f988b5e388c01b2eec8c6a32`. Stage 1: `d830b59`.

## Implemented source

- Independent Gmail and Outlook opened-message adapters with bounded extraction, DOM mutation handling, SHA-256 deduplication and cancellation. Selectors are fixture-tested candidates; live provider acceptance is outstanding.
- Email-only editable categories, weights and thresholds in `apps/extension/data/email-detector-config.js`. Reuses the existing WhatsApp normalizer and lexical detector without changing its thresholds or inline UI. Related lexical categories are grouped, so duplicate descriptions of one clue do not manufacture independent evidence.
- Local sender history stores addresses only, at most 512 observed and 128 explicitly trusted. Seeing the same sender repeatedly does not verify identity or silently trust them. Gmail/Outlook do not expose a reliable contact/history API here: explicit trusted senders are the only known-sender input implemented. No sudden-change inference from stored bodies is claimed.
- Exposed header failures, sender/Reply-To differences, brand lookalikes, mixed Latin/Cyrillic, link-label mismatch, shorteners/IP/TLD/brand paths and attachment filename clues. No attachment is opened. Missing headers remain unavailable. Fake reply subjects require explicit absence of a thread; adapters currently leave that unavailable.
- Separate popup opt-ins request only the selected provider origins. Background validates exact provider origin, top frame, extension identity and popup-only mutations. Only sender addresses cross the content/background boundary. Content cannot add trusted senders or send bodies. Trust/untrust/history clear are in popup settings.
- Small yellow/red top-of-email warnings with fixed reasons. Safe shows nothing. Red warnings intercept ordinary primary and auxiliary link clicks and show the actual destination before opening with noopener/noreferrer. This is page-level confirmation, not a network blocker; other page handlers, context-menu navigation and unsupported layouts are outside this guarantee. Attachments and messages are not moved/deleted.
- Wrong-flag button increments a bounded local aggregate counter only; no body, address or report is retained or uploaded. This is not a review inbox.
- Public reputation uploads and LLM uploads remain disabled. Repository privacy rules prohibit raw email content in AI. No remote classification endpoint is installed.

## Evaluation and release status

120 fixtures: 50 historic Nazario phishing and 50 SpamAssassin ham samples from the public research mirror, plus 20 authored tricky legitimate notifications. Ordinary SpamAssassin spam was excluded instead of relabeled as phishing. Public bodies are transformed by the import script: address/phone/header redaction, greeting normalization and URL query/userinfo/path reduction. The CSV is parsed only as text; no links are followed and no attachments are fetched. Fixtures are not shipped in extension dist. Historic source labels can contain noise; this is not modern inbox accuracy.

Frozen initial email policy versus updated policy and technical checks (`node apps/extension/scripts/evaluate-email.mjs`):

| Set | Before FP / FN | After FP / FN |
| --- | --- | --- |
| 80 public tuning samples (40 scam / 40 ham) | 0 / 38 | 4 / 23 |
| 20 public comparison samples (10 scam / 10 ham) | 0 / 9 | 0 / 8 |
| 20 authored legitimate regressions | 0 / 0 | 0 / 0 |

The comparison set was evaluated before tuning, so it is a comparison split, not an untouched blind benchmark. These miss rates are poor. **Not ready for release.** Do not treat a silent email as safe. Further detection work, a fresh independent dataset, independent Engineer A review and real Gmail/Outlook installed-browser acceptance remain required. No app or installed extension was changed.

Validation: stage-1 full verifier passed; the authorized full verifier passed again during this increment. A restricted run failed access to Windows test-file ancestry; no native security checks were weakened. Final feedback-route changes and the observer-test timing correction receive a repeat full extension suite. Build/smoke parity passed. The observer regression now waits for actual observed state instead of assuming the callback completes in 260 ms under concurrent native tests.

## Public data attribution

Research mirror: https://github.com/rokibulroni/Phishing-Email-Dataset (Rokibul Roni; README declares CC BY-SA 4.0). Original corpora: Jose Nazario phishing corpus and Apache SpamAssassin public corpus. Adapted public fixture portions are CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/ . Changes are listed above; source row IDs and original-body hashes are retained. No endorsement is implied. Dataset licensing/provenance should receive release review before redistribution; it is not part of the installed package.

## 15 October continuation — extension 0.2.4 test build

Owner requested remaining implementation and a GitHub ZIP without a release. Added bounded semantic request patterns to editable email policy, plain-text URL technical checks, reader-status reporting (including unsupported/paused/unavailable), trusted-sender settings access from the compact warning, and prioritized explanations. Reader status is an ephemeral capped 32-tab map with a 15-second expiry and fixed enums/counts only. Trust changes stay popup-only; no sender is silently trusted. Red-link confirmation now rechecks that the original link is still attached, unchanged and belongs to the current snapshot. Observer watches sender/attachment/visibility metadata changes. New regressions cover asynchronous stale snapshots, status validation, semantic requests and exact/stale link confirmation.

Public evaluation remains insufficient for release: total 4 false positives among 70 legitimate samples and 31 false negatives among 50 phishing samples. The original frozen policy had 0/47. This continuation improves recall on the tuning examples but does not establish reliable inbox protection. Actual Gmail/Outlook acceptance, fresh independent corpus evaluation and independent peer review are still outstanding. User has been asked whether a harmless test account is available; no private inbox is accessed.

No LLM or public reputation uploads were added because raw-email privacy restrictions remain binding. No attachment byte scanning, automatic deletion or email delivery blocking is claimed. The ZIP is a labeled test build, not a production release. Native app/installed browser changes are not part of this download task.

Final local validation for 15 October: all 115 extension tests PASS, full tools/verify.ps1 PASS, extension build/smoke parity PASS. Source review caught a freshness fence that stayed invalid after unrelated DOM updates; fixed with a digest-only verified-generation map, committing a snapshot only after its asynchronous consumer remains current. Regression confirms unchanged emails regain link freshness without duplicate scoring. Package script validates root manifest and every shipped file hash, rejects fixtures/tests and bounds package size. Live inbox/independent review/quality gates above remain outstanding.
