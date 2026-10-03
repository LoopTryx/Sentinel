# Evidence — Scan Center consuming the issue-9 progress contract (sentinel-ui)

Branch `sentinel-ui`. The Scan & Detect center now renders the typed progress
and evidence-report contracts from `codex/issue-9-scan-progress`
(docs/handoffs/scan-progress.md) ahead of that PR's merge, so the journeys are
rehearsed before the adapter lands.

## What was built

- `apps/ui/src/state/scanTypes.ts` — verbatim field-for-field TS mirrors of
  `DirectoryScanProgress`, `SelectedFileReport`, `SelectedDirectoryReport`,
  `ScanReportFinding` (u64 counters as canonical decimal strings) plus a
  decoder that rejects numeric JSON, signs and leading zeros, per the
  contract. These become `@sentinel/contracts` imports when issue #9 merges.
- `apps/ui/src/state/scanSource.ts` — the adapter seam: `unavailableScanSource`
  (honest default, real inspection visibly disabled) and
  `rehearsalScanSource` (labeled replay of recorded benign sequences: benign
  finish, gaps+limit, user cancel). The rehearsal never touches the filesystem.
- `apps/ui/src/views/ScanView.tsx` — Scan Center UI: indeterminate activity
  while `stage=running` (no fabricated percent), counter tiles rendered as
  text, traversal/cancelled/limit badges, gaps summary, evidence report with
  job/selection correlation and outcome badges, cancel with sticky behavior
  and focus move, repeated-selection guard, and the standing rule that a scan
  result never renders a protection shield (engine inactive, coverage partial).
- `apps/ui/src/ScanView.test.tsx` — 7 jsdom behavior tests: disabled-until-
  rehearsal, indeterminate running (asserts no `%` text), string counters,
  cancel journey, gaps journey, repeated-selection guard, decoder rejections.
  Full suite: 13/13 pass. `pnpm --filter @sentinel/ui build` passes.

## Manual evidence (headless browser, fixture data only)

- `running.png` — rehearsal running: typed counters counting up, cancel
  available, "Preview · agent unavailable" status pill unchanged.
- `finished-with-gaps.png` — finished with 1 skip: "Traversal complete" badge
  plus the incomplete-by-design summary; evidence report shows coverage
  partial and full signature engine inactive.

## Limits, honestly

- The real scan adapter (native selection + job wrapper) is Codex's pending
  work; START stays disabled outside rehearsal and says so explicitly.
- DTO types are local mirrors pending the contracts merge — flagged for the
  reviewer; final merge must take Codex's generated files as authoritative.
- Academy lesson shells were not added: no consumable lesson data exists on
  the current issue-14 branches (checked; only fixtures). Deferred until the
  lesson content lands.
- Chrome-extension local tools (issue #39) ship in the extension popup itself;
  no desktop-UI surface is required for them yet.
