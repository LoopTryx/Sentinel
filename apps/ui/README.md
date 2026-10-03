# Sentinel console

Recovered GLM Y2K UI, integrated into the Sentinel pnpm workspace.

From repository root:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @sentinel/ui dev
pnpm --filter @sentinel/ui build
```

Open the printed localhost URL. This is a browser frontend preview, not an installed desktop service. Local synthetic alert, invented-password estimates and message clues work offline after dependencies are installed. Native scanning/quarantine/live history adapters are visibly unavailable; use the existing CLI/WPF preview for actual selected read-only scans. See docs/evidence/sentinel-ui-integration.md for exact scope and checks.
