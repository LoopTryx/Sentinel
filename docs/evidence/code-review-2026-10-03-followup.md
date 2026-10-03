# Sentinel scheduled review follow-up — 3 October 2026

Review snapshot: remote main `3e29701cd347c32ddb9e9d37e6da17dd4cbde835`, fetched during this run. Compared with the previously fully reviewed/tested main `9f444bd`, only chat.md and the previous review evidence changed. First-party production code, configuration and tests on main are unchanged. Previous whole-repository coverage/checks remain recorded in code-review-2026-10-03.md; they were not rerun or claimed as new results.

Read the collaboration rules, master requirements/current S1 amendment PR #22, STATUS, chat, published branches, issue records, and PR review comments. Distinguish the school showcase's closed synthetic lessons from later installed protection. Review only: no fixes, merges, contributor branch changes or retirement.

## New actionable finding — GLM UI ownership, existing #10 / PR #31

**P2: display switches do not identify their preference to assistive technology.** Exact published head `8803ac4ab0712acef8aed136a4d8321a15e2275a`, `apps/ui/src/views/SettingsView.tsx:33-42,49-58`. Both role=switch buttons contain only On/Off. The sibling Reduce motion / Reduce transparency text has no label association, aria-label or aria-labelledby; enclosing section names do not name the individual controls.

Trigger: navigate to Settings and focus either switch with a screen reader, initially with both settings false. Both controls expose the same Off name and checked=false; changing state changes the name to On without identifying what changed. Users cannot distinguish the accessibility preferences by control name.

Harmless proof: rendered the exact committed SettingsView and its committed dependencies with React renderToStaticMarkup in TEMP. Both actual rendered buttons were `<button type="button" role="switch" aria-checked="false" class="btn">Off</button>`. A focused label-association regression failed. This is source/rendered-markup evidence; no manual screen-reader session is claimed. Initial temporary harness attempts failed on module resolution, then the completed test executed and failed on the intended assertion.

Correction: GLM should bind each switch to its visible localized preference name using aria-labelledby (or an equivalent explicit label), optionally bind the explanatory hint with aria-describedby. Keep aria-checked as state and a stable preference name across toggles. Acceptance: accessible-name assertions distinguish Reduce motion and Reduce transparency in both states, and actual keyboard/screen-reader verification before presentation acceptance.

Update existing issue #10 and PR #31 rather than duplicate their feature ticket. The three already published PR #31 freshness/tone/modal findings remain unchanged and are not new findings here; PR #34 preserves their reproductions. The owner's earlier-UI recovery request is a separate presentation decision, not technical approval of #31.

## Verified proposed corrections — Codex logic ownership

| Record | Exact proposed head | Independent isolated verification |
| --- | --- | --- |
| #24 / PR #27 clock rollback | `0f60f749fea5b722b68774cdec6bb9be9ec96477` | Four cache and two provider tests pass; lookup before retrieval returns clock_anomaly with provenance retained. |
| #23 / PR #28 recovery ownership | `655f1a502d84991979c1d1a01e7c4303a38e3861` | Seven journal tests pass including same-process and actual child-process contention, release/reopen and acknowledged lease preservation. Exclusive lock precedes replay/truncation. |
| #25 / PR #29 retention | `adde23d822bc9f9edb0b49e992832f354a8980ab` | Eight cache and two provider tests pass; three retained generations/candidates, bounded reads, persisted refresh and operation locking. |
| #9 / draft PR #18 report validation | `086a33b168e155b8e2f6e346a498b598d7a276bd` | Actual reports.ps1 passes base validation, failure-state consistency and directory aggregate validation, including negative/legitimate partial cases. |

These corrections are candidates, not merged resolutions. Keep issues open pending reviewed integration. PR #29 independently lacks PR #27's clock_anomaly change: retain both when integrating. Coordinate #18's ScanJob.ps1 with the pending #21 shutdown changes. PR #29 explicitly documents directory enumeration scaling, unavailable after three invalid candidates and possible cleanup failure after committed replacement; these are not undisclosed new findings. No integrated merge-tree, crash-injection or production benchmark claim.

## New educational leaves and checks

Source review covers bounded inputs, typed/generated contracts, static scenario feedback, errors/redaction, CLI callsites and integration handoffs at PR #26 `6dcce44a4bd55a140148c932d7e09cd4268f8fae`, #30 `9e02a7fda987048093bbdda8e9d769da94b7bbed`, #32 `b8ea1f2b6221cb4c699a1046cccfd40c168552ff`, #33 `c23ace27e87027ae5662ede3ed3a91fa7ab5e303`. No additional substantiated defect identified. These leaves do not provide connected desktop/extension protection; that is disclosed pending integration rather than a new bug.

Exact-head `cargo +1.98.1-x86_64-pc-windows-gnu test --offline -p sentinel-intel -p sentinel-cli` runs completed with exit 0 for all four leaves. URL X-Ray: 12 new library/CLI tests; Phishing Dojo: seven; USB Autopsy: eight; Password Autopsy: five. Each also passed its five existing status/benign-scan/import CLI tests and three cache/two provider tests. Source archives are isolated in TEMP; no generated binding changes enter a contributor checkout. All ten inspected PRs #18, #26–#34 had both verify checks completed successfully at the inspected heads. Green CI does not supersede concrete PR #31 failures or approve its design.

Serialize the lessons' shared intel/proto exports, internal dependency, CLI match arms/help and STATUS updates during later integration. No review-time merge was performed.

## Publication blocker and safety limits

The attempt to publish correction comments to GitHub was **not executed**: automatic approval review failed because the account hit its usage limit and reported retry at 2:09 PM. The reviewer explicitly said this was a review failure, not a finding that the action was unsafe. Do not bypass that approval check. No new issue/PR comments or chat.md message were published during this follow-up. This local uncommitted report is the pending handoff; publish to existing issues/PRs and append a fresh-main additive chat message when the approval service is available.

No E: access, USB/HID blocking, live malware/EICAR files, real credentials, device policy changes or Defender changes. No manual browser, screen-reader or school-event rehearsal claimed. Remaining whole-product capability gaps stay their existing issues; no security certification or proof of zero defects.

## Later publication — 18:07 Dubai scheduled run

The approval service became available on the subsequent scheduled run. This historical record and its verified finding were published without changing contributor branches: settings finding to issue #10 / PR #31; correction checks to #23/#28, #24/#27, #25/#29 and report validation to draft #18. Comments are linked in code-review-2026-10-03-1807.md. The earlier publication failure above remains an accurate record of that attempt, not a current access blocker.
