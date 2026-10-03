# GLM UI-01 technical review — 2026-10-03

Reviewed PR #31, exact published head `8803ac4ab0712acef8aed136a4d8321a15e2275a` in an isolated managed checkout. Review scope: current DTO/rendering/action/state code, fixture labeling, failure/freshness representation and keyboard evidence access. GLM branch/source remained untouched. This technical review does not approve visual design; the owner separately asked GLM to recover the older local UI, being coordinated in Start Sentinel logic work.

## Checks and result

- Locked dependency install succeeded; independent `pnpm -r typecheck`, `pnpm -r test` (37/37) and `pnpm -r build` passed.
- Three added regression assertions failed against the exact head: future timestamp returned current; expired fixture returned expired+ok; modal forward Tab was not prevented with only Close enabled.
- After removing temporary regression file, full `tools/verify.ps1` passed (Rust fmt/clippy/workspace tests/TS bindings, TS/UI and all 32 extension harness/build/parity checks).
- GitHub check-runs for that exact head show both verify jobs completed successfully. Existing green tests do not cover the three reproduced defects.
- React text rendering, fixture allowlist selection, fixed local datasets, visibly disabled agent/lesson actions and subject-bound assessment rendering were retained. No live backend, USB policy, secret upload or new protection capability was exercised. No manual browser/assistive-technology/event-laptop rehearsal or visual approval is claimed.

## P2: future reading becomes Current

`apps/ui/src/state/threat.ts:40–46` validates parseability but not observation time later than now. At now 2026-10-03T10:10Z, observed 11:10Z with no expiry returns current. A rollback or future fixture timestamp silently receives a current badge. Correction: explicit non-current clock anomaly/unknown state, valid clock/timestamp boundaries, appropriate warning and no success tone; retain historical risk separately. No machine-clock change was used in the reproduction.

## P2: expired reading retains positive console tone

`apps/ui/src/state/threat.ts:74` computes tone from risk/coverage without freshness. Existing stale fixture at 10:10Z is expired yet ok; DashboardView and tone CSS choose green/check/Completed-checks hero. The visible expired badge is useful, but it does not correct the positive current-state shell. This conflicts with master section19's stale/unknown truthful-state direction. Correction: account for non-current freshness in the shell/hero while preserving historical risk and high-risk warnings; update tone spec and the existing test that explicitly expects expired+ok.

## P2: forward modal Tab trap includes disabled controls

`apps/ui/src/components/AwarenessDialog.tsx:61–72` selects disabled buttons and treats the last disabled action/lesson as the final focusable node. The high scenario has exactly one enabled Close button. Focus that button and dispatch cancelable bubbling Tab: defaultPrevented=false. Native default traversal is therefore not trapped by this handler. Existing test tries focusing the disabled last button (focus does not move), then observes Close still focused; it never proves wrap. Correction: filter disabled/hidden/non-tabbable nodes and handle final enabled/first enabled/outside focus; add forward/backward regression and real browser confirmation. Reproduction establishes DOM event-handler failure, not a manual native Tab traversal result.

## Reproduce independently

The adjacent `ui31-regressions.tsx` is source evidence, intentionally not a default test-suite file. In a disposable checkout of exact head 8803ac4, copy it to `apps/ui/src/codex-review-regressions.test.tsx`, install locked dependencies, then run:

```
pnpm --filter @sentinel/ui test -- codex-review-regressions.test.tsx
```

Expected current-head result: three failed assertions with observed current, expired+ok, and one enabled control/Tab prevented=false. Remove that exact temporary file afterward before rerunning the baseline verifier. Do not change GLM's active branch. Re-run on GLM's published corrected head to verify actual fixes, with the legitimate existing tests preserved.

## Unified ownership and next action

Findings published on PR #31 comment: https://github.com/LoopTryx/Sentinel/pull/31#issuecomment-5967238206 . GLM owns the changes on its branch, updates behavior tests/spec and publishes a corrected head; Codex re-runs these exact regressions and checks. Coordinator serializes review/integration; do not merge on the strength of CI alone or treat technical review as owner design approval. S1 plan PR #22 remains pending adoption, but the owner's smaller school-showcase scope is authoritative.

Runtime/native bridge, scans and Academy leaf wiring remain separate. Existing generated DTO consumption needs no view-owned schema invention; GLM's early scan-progress/counters request remains a Codex contract follow-up. Pending URL X-Ray #26, Phishing Dojo #30 and USB Autopsy #32 handoffs must survive integration. Next independent Codex work: invented-input Password Autopsy after a fresh ownership check, and reviewed local adapter integration. Current Trello connector previously could not locate Sentinel; preserve the original 23-card list and synchronize when the existing board is accessible. Automation remains active; no S1 completion claim.
