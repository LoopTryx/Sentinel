# Evidence — UI-01 Y2K shell, dashboard, awareness dialog (issue #10)

Branch `glm/issue-10-y2k-shell`. All rendered data is fixture mode and visibly
labeled as such; nothing here is a live protection claim.

## Automated checks (run locally on the owner's Windows machine)

- `pnpm -r typecheck` — pass (TypeScript strict, tsc 7).
- `pnpm -r test` — 37 tests, 37 pass:
  - `state/threat.test.ts` (14): freshness matrix (unknown/unparseable/current/stale/expired/future-expiry), tone matrix incl. "clean + incomplete coverage is never ok" and "unknown risk is always uncertain", rollup counts, all scenarios stay in fixture mode.
  - `state/notifications.test.ts` (5): subject+time binding, dedupe by assessment id, clean-complete raises no risk notification, expired freshness surfaces, severity ordering.
  - `App.render.test.tsx` (7): per-scenario static states (unknown/partial/stale/offline never read clean, no aggregate protection percentage, no "protected" wording), shell nav groups + status rail present, fixture label asserted.
  - `components/AwarenessDialog.dom.test.tsx` (5, jsdom): opens bound to subject/observation-time with focus inside, focus returns to invoker on close, Escape closes, Tab wraps within the dialog, agent-dependent actions are visibly disabled with an explanation.
  - `App.dom.test.tsx` (5, jsdom): nav buttons + `aria-current`, honest placeholder bodies with dependency reference, dialog focus restoration from the dashboard, scenario switcher re-derives tone while keeping the fixture banner, dismiss affordance, settings switches drive `data-motion`/`data-transparency`.
- `pnpm -r build` — pass (vite build, 15 kB css / 259 kB js).
- `tools/verify.ps1` (full, local): pass — rustfmt, clippy, workspace Rust tests + generated-binding check, TS typecheck/tests/build, extension syntax + 32 harness tests, build + parity smoke. Environment note: this machine lacks MSVC; the repo-pinned `1.98.1` channel resolved to MSVC and failed at `link.exe`. A repo-local rustup override to `1.98.1-x86_64-pc-windows-gnu` (with WinLibs gcc 16.2 already installed) made the verifier pass. This is a local environment override only; committed files were not changed for it.

## Manual / visual evidence

Six reproducible screenshots in `docs/evidence/ui-01-shell/*.png`, captured with
`apps/ui/scripts/capture-screenshots.mjs` (vite preview + headless Edge,
1440×1000): preview (mixed uncertain), clear (complete/no findings with caps),
suspicious, high-risk (static danger tone, no flashing), stale (expired reading),
offline (all capabilities unavailable). They show: permanent fixture banner;
separate risk/coverage/freshness/mode badges; per-capability tiles; attention
notifications opening the subject-bound awareness dialog.

During capture a real defect was found and fixed: an unterminated CSS rule in
base.css made the minifier corrupt all following shell rules (sidebar rendered
unstyled). Fix verified by re-capture (before/after visible in git history of
`apps/ui/src/styles/base.css`).

## Not claimed (manual, open for later increments)

No NVDA/screen-reader rehearsal, no 200%/400% reflow check, no forced-colors
device pass, no light-theme visual review, no real Chrome extension behavior,
and no live backend connectivity is claimed from this jsdom/fixture work.
Connection states `connecting`/`live`/`unavailable` exist in the status rail;
the live adapter awaits Codex LOGIC-01 (#6/#19). Keyboard/focus claims above
are jsdom behavior tests, not manual assistive-technology evidence.

## Follow-ups for #11 and beyond

- Wire scan/report flows through Codex's authenticated adapter; replace the
  disabled awareness-dialog actions with real ones once methods exist.
- Extension popup/block-page presentation against the LOGIC-03 contract.
- Self-host Inter/Space Grotesk/JetBrains Mono (OFL) offline.
- Reviewed Arabic RTL / Hindi / Malayalam at R3 with logical-property audit.
