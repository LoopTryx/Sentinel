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
| 80 public tuning samples (40 scam / 40 ham) | 0 / 38 | 3 / 25 |
| 20 public comparison samples (10 scam / 10 ham) | 0 / 9 | 0 / 8 |
| 20 authored legitimate regressions | 0 / 0 | 0 / 0 |

The comparison set was evaluated before tuning, so it is a comparison split, not an untouched blind benchmark. These miss rates are poor. **Not ready for release.** Do not treat a silent email as safe. Further detection work, a fresh independent dataset, independent Engineer A review and real Gmail/Outlook installed-browser acceptance remain required. No app or installed extension was changed.

Validation: stage-1 full verifier passed; the authorized full verifier passed again during this increment. A restricted run failed access to Windows test-file ancestry; no native security checks were weakened. Final feedback-route changes and the observer-test timing correction receive a repeat full extension suite. Build/smoke parity passed. The observer regression now waits for actual observed state instead of assuming the callback completes in 260 ms under concurrent native tests.

## Public data attribution

Research mirror: https://github.com/rokibulroni/Phishing-Email-Dataset (Rokibul Roni; README declares CC BY-SA 4.0). Original corpora: Jose Nazario phishing corpus and Apache SpamAssassin public corpus. Adapted public fixture portions are CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/ . Changes are listed above; source row IDs and original-body hashes are retained. No endorsement is implied. Dataset licensing/provenance should receive release review before redistribution; it is not part of the installed package.
