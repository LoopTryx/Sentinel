# Version-control integration index

Snapshot: 10 October 2026. Main before this documentation: `8fb79c8644f04ab4e1f714aea8d1fd5c3473538f`. This is a coordination snapshot; fetch current heads before acting. Main is the sole integration source. Both engineers may own UI and logic by issue/file claims; see [collaboration rules](../AI-COLLABORATION.md).

## Cleanup completed

- Retired remote codex/docs-v1-readme (26d76623a20e541e9b549ed1819b6b123ac26de6) and codex/sentinel-ui-integration (c7d257c0224dd47c2b424636f6a9d6cda6751506). Both commits are ancestors of main; no open PR or registered worktree depends on these branch names. History is recoverable from main and local refs.
- Closed redundant PR43, PR51 and PR53 because their complete heads are already ancestors of main. Their dependency branches remain for stacked PRs; closure does not imply a new merge or acceptance test.
- Corrected local warning-events, native-pending and password-layout branches to track their matching remote branches. Fast-forwarded unused local main without changing the active checkout.
- Preserved active worktrees, contributor branches, local-only commits and untracked generated audit files. No broad reset/clean, dependency churn or code rewrite.

## Open review stack

33 open PRs remain after the three redundant closures. A non-main base is a dependency: review the leaf delta and rebase/retarget only on the editing owner's branch after integration of its base. Do not delete a branch used as an open PR base.

| PR | Editing branch | Base | Snapshot head |
| --- | --- | --- | --- |
| [#60](https://github.com/LoopTryx/Sentinel/pull/60) | `codex/engineer-a/issue-14-download-selection` | `main` | `a5f5b58` |
| [#59](https://github.com/LoopTryx/Sentinel/pull/59) | `codex/engineer-b/issue-11-pr41-verifier` | `sentinel-ui` | `91e0297` |
| [#58](https://github.com/LoopTryx/Sentinel/pull/58) | `codex/issue-15-powershell-launch` | `main` | `c99643e` |
| [#57](https://github.com/LoopTryx/Sentinel/pull/57) | `codex/issue-14-shortener-prize` | `codex/issue-14-warning-events` | `eb286e3` |
| [#56](https://github.com/LoopTryx/Sentinel/pull/56) | `codex/issue-14-warning-events` | `main` | `83793d5` |
| [#54](https://github.com/LoopTryx/Sentinel/pull/54) | `codex/issue-13-local-reuse-audit` | `main` | `7fe2753` |
| [#52](https://github.com/LoopTryx/Sentinel/pull/52) | `codex/issue-8-native-pending` | `codex/issue-8-native-contract` | `98a19e5` |
| [#50](https://github.com/LoopTryx/Sentinel/pull/50) | `codex/issue-9-clamav-engine` | `main` | `49c95cb` |
| [#49](https://github.com/LoopTryx/Sentinel/pull/49) | `codex/issue-8-browser-activity` | `main` | `e507450` |
| [#48](https://github.com/LoopTryx/Sentinel/pull/48) | `codex/issue-14-navigation-hold` | `main` | `279d6f0` |
| [#47](https://github.com/LoopTryx/Sentinel/pull/47) | `codex/extension-owner-scope` | `main` | `db74126` |
| [#46](https://github.com/LoopTryx/Sentinel/pull/46) | `codex/issue-9-dispatch-contract` | `codex/issue-9-selection-bound-poll` | `699d5c3` |
| [#45](https://github.com/LoopTryx/Sentinel/pull/45) | `codex/issue-9-selection-bound-poll` | `codex/issue-9-local-dispatch` | `6967754` |
| [#44](https://github.com/LoopTryx/Sentinel/pull/44) | `codex/issue-9-local-dispatch` | `codex/issue-9-selection-registry` | `31e5a60` |
| [#42](https://github.com/LoopTryx/Sentinel/pull/42) | `codex/issue-9-selection-registry` | `codex/issue-9-scan-progress` | `66a3c9d` |
| [#41](https://github.com/LoopTryx/Sentinel/pull/41) | `sentinel-ui` | `main` | `96bb8e7` |
| [#36](https://github.com/LoopTryx/Sentinel/pull/36) | `codex/issue-9-scan-progress` | `main` | `76462e7` |
| [#35](https://github.com/LoopTryx/Sentinel/pull/35) | `codex/issue-14-academy-review-handoff` | `main` | `e60ca13` |
| [#34](https://github.com/LoopTryx/Sentinel/pull/34) | `codex/issue-10-ui-review-evidence` | `main` | `1abd6df` |
| [#33](https://github.com/LoopTryx/Sentinel/pull/33) | `codex/issue-14-password-autopsy` | `main` | `c23ace2` |
| [#32](https://github.com/LoopTryx/Sentinel/pull/32) | `codex/issue-14-usb-autopsy` | `main` | `b8ea1f2` |
| [#31](https://github.com/LoopTryx/Sentinel/pull/31) | `glm/issue-10-y2k-shell` | `main` | `8803ac4` |
| [#30](https://github.com/LoopTryx/Sentinel/pull/30) | `codex/issue-14-phishing-dojo` | `main` | `9e02a7f` |
| [#29](https://github.com/LoopTryx/Sentinel/pull/29) | `codex/issue-25-intel-retention` | `main` | `adde23d` |
| [#28](https://github.com/LoopTryx/Sentinel/pull/28) | `codex/issue-23-recovery-writer` | `main` | `655f1a5` |
| [#27](https://github.com/LoopTryx/Sentinel/pull/27) | `codex/issue-24-intel-clock` | `main` | `0f60f74` |
| [#26](https://github.com/LoopTryx/Sentinel/pull/26) | `codex/issue-14-url-xray` | `main` | `6dcce44` |
| [#22](https://github.com/LoopTryx/Sentinel/pull/22) | `codex/school-showcase-plan` | `main` | `b2d8475` |
| [#21](https://github.com/LoopTryx/Sentinel/pull/21) | `codex/issue-7-desktop-shutdown` | `main` | `7417384` |
| [#20](https://github.com/LoopTryx/Sentinel/pull/20) | `codex/issue-8-native-contract` | `main` | `d4683e4` |
| [#19](https://github.com/LoopTryx/Sentinel/pull/19) | `codex/issue-6-durable-jobs` | `main` | `31d31ea` |
| [#18](https://github.com/LoopTryx/Sentinel/pull/18) | `codex/issue-9-report-handoff` | `main` | `086a33b` |
| [#17](https://github.com/LoopTryx/Sentinel/pull/17) | `codex/issue-7-worker-output` | `main` | `c4facee` |

## Integration gates and next work

- PR41 and its verifier leaf PR59 are separate. Green candidate verifier checks do not resolve damaged-key regeneration, restore overwrite, false live-protection state or unbounded synchronous scanning. Independent review and focused harmless regressions remain required. Preserve the unpublished legacy checkout pending accepted editor handoff.
- PR60 remains Engineer A's download preparation, with Engineer B independent contract/security review required. Current head above must be reviewed, not inferred from older review evidence. No inspection authority/platform acceptance follows from a preflight helper or correlation decoder.
- PR56/57 warning and PR58 launcher candidates retain installed production/visible acceptance gates. Controlled Chromium, focused identity tests and CI are distinct from deployed release acceptance.
- Issues23/24/25 stay open while candidate fixes PR28/27/29 remain unintegrated. Do not close issue scope merely because a candidate passes tests.
- Owner scope amendment PR47 remains pending integration; it is a product requirement, not evidence of implemented expanded S1 capabilities.
- Main's STATUS narrative contains historical candidate descriptions. Use commit ancestry for integration status and exact-head reviews for acceptance; this index does not claim every open PR is merge-ready.

## Retirement policy

Before retirement: fetch, prove exact head reachable from main, confirm no open PR head/base dependency or active worktree/claim, record recoverable SHA, then remove only the obsolete remote name. Keep short-lived issue branches while reviews/dependencies remain. No force push. No branch retirement substitutes for security/release evidence.