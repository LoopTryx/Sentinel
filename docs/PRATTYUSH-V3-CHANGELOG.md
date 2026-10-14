# Prattyush changes for v3

Owner-requested branch: `prattyush-changes-for-v3`. Created 14 October 2026.

This branch keeps the owner's requested changes together for review and inclusion in the next Sentinel version. A commit here is **not** an installed update, a main merge or a release.

## Base and preserved work

- Base: `55b7bb958f1af891f988b5e388c01b2eec8c6a32`, Engineer A's desktop-v2 branch / PR73. This preserves the v2 account workspace, password tools, tray behavior and automatic extension connection. The stacked dependency must be integrated before, or alongside, this branch; do not replace main with this branch.
- New scam-detector work comes from Engineer B PR72, final compact-warning source `168059a4682ce2402ce0823a255e2c97a6fa82c5`. Its published history remains intact.
- Earlier desktop/extension design work is recorded in PR68, PR69 and PR70. Existing v2 design is retained, not replaced with the older Engineer B application snapshot.
- No USB blocking/service/watchdog changes are included. Those remain a separate security-reviewed handoff on PR74.

## Changes recorded

| Date | Owner request | Current state | Checks / remaining work |
| --- | --- | --- | --- |
| 14 Oct 2026 | Improve scam detection without changing the existing chat flow | Code included: normalization, English/Arabic categories, configurable combination scoring, proximity, local link naming analysis, tiers and reasons | Focused 19 tests passed in this v2-compatible checkout. Independent review and actual installed-browser validation remain pending. |
| 14 Oct 2026 | Remove the large WhatsApp report/settings panel | Code included: small red badge and a brief two-line explanation; no inline sender selectors, checkboxes or feedback dashboard | DOM tests cover expansion, compact structure, recycling and latest-100 cap. Scoring is unchanged. |
| 14 Oct 2026 | Preserve the current v2 UI and extension features while updating | Code included: v2 popup/account/search/auto-connect files preserved; release manifest key and permissions preserved; extension version 0.2.3; new detector modules declared | Desktop UI/native frame builds passed; all 83 extension tests and build/package parity passed. Independent review still required. |
| 14 Oct 2026 | Keep the chosen scam URL design | Existing v2 red gradient, mascot, shadow and looping wink retained | No surprise redesign. |
| 14 Oct 2026 | Update the currently installed app and extension | **Not installed**: prepared source/build only | Browser automation stopped because Opera's current URL could not be verified. No installed desktop/extension files were replaced in this update attempt. Owner now wants to collect changes for v3. |
| 14 Oct 2026 | Add staged Gmail/Outlook scam checks, preserving WhatsApp | Stage1 implemented and shown: local bounded readers, isolated provider selectors, exposed headers, link/attachment metadata, transient cache and observer cleanup | 13 extraction +12 WhatsApp regressions /96 total extension tests/build/parity PASS. No real inbox permission or content-script activation. Scoring, sender history, technical checks, banners and >=100-email corpus remain later stages. See docs/evidence/email-stage-1.md. |

## Evidence and limits

- Editable policy: `apps/extension/data/message-detector-config.js`.
- Synthetic corpus: `apps/extension/test/message-detector-corpus.json` (80 labeled messages).
- Before/after evaluator: `node apps/extension/scripts/evaluate-messages.mjs`. The prior PR72 corpus comparison was 21 false positives / 9 false negatives before versus 1 / 0 after; this is an authored synthetic comparison, not field accuracy. Rerun when policy changes.
- Engine accepts explicit sender context; the compact inline adapter uses unknown context. No automatic contact recognition or history-change detection is claimed.
- Raw message uploads and optional LLM classification remain disabled. Feedback helper is retained as a library; no new inline controls are installed into v2's existing account popup.
- Full repository verification passed for PR72's prior source. This v2 integration has focused tests/UI/native builds; a new full gate, independent peer review and installed-browser acceptance are still needed before release.
- The new integration test initially caught the release key missing from the development manifest (v2 normally injects it during packaging). The public release key is now included explicitly; the test confirms the existing `cjmdcjnpmnpebifncdejcmhkgapnjdhh` identity and native connection permissions. No private key is included.
- Branch creation does not change app release numbering: desktop remains based on v2; v3 packaging/versioning is a later release step.

## How to record future changes

For each owner request, add a dated row above: **what was requested → what changed → checks → what remains**. Commit the matching code on this branch. Clearly mark ideas as **planned**, finished source as **implemented**, checked builds as **tested**, and actual machine updates as **installed**. Never mark a request done solely because a preview looks right.

Keep the changelog and PR description aligned with the final requested behavior. Use normal fast-forward pushes and preserve other contributors' files. Coordinator integration, security review and release gates remain in force. No automatic merge or release is authorized by this branch request.

## 14 October — email detector draft

Implemented Gmail/Outlook reader, local scoring/config, technical clues, explicit site opt-ins, address-only sender history and compact warnings/link confirmation. Added 120 evaluation fixtures and measured results. WhatsApp flow stays intact. See [email draft evidence](evidence/email-detector-draft.md). Public-corpus recall is poor; not release-ready. Independent review and actual inbox acceptance remain. No installed extension changed.
