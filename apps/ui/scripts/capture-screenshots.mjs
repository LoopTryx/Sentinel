// Reproducible screenshot capture for apps/ui fixture scenarios.
// Usage: pnpm build && node scripts/capture-screenshots.mjs [outDir]
// Serves dist/ via `vite preview`, captures each ?scenario= state with
// headless Chrome. Fixture data only — no secrets, no live device state.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const uiRoot = resolve(here, '..');
const outDir = resolve(here, process.argv[2] ?? '../../../docs/evidence/ui-01-shell');
mkdirSync(outDir, { recursive: true });

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const chrome = chromeCandidates.find((p) => existsSync(p));
if (!chrome) {
  console.error('No Chrome/Edge found. Set CHROME_PATH.');
  process.exit(1);
}

const port = 44173;
const viteCli = resolve(uiRoot, 'node_modules/vite/bin/vite.js');
const preview = spawn(
  process.execPath,
  [viteCli, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
  { cwd: uiRoot, stdio: 'pipe' },
);
await new Promise((resolveReady) => {
  preview.stdout.on('data', (chunk) => {
    if (String(chunk).includes('Local:')) resolveReady();
  });
  setTimeout(resolveReady, 8000);
});

const scenarios = ['preview', 'clear', 'suspicious', 'high', 'stale', 'offline'];
let failed = 0;
for (const scenario of scenarios) {
  const out = resolve(outDir, `dashboard-${scenario}.png`);
  const result = spawnSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--virtual-time-budget=6000',
    '--window-size=1440,1000',
    `--screenshot=${out}`,
    `http://127.0.0.1:${port}/?scenario=${scenario}`,
  ]);
  if (result.status !== 0 || !existsSync(out)) {
    console.error(`FAILED: ${scenario}`);
    failed += 1;
  } else {
    console.log(`captured ${out}`);
  }
}
preview.kill();
process.exit(failed === 0 ? 0 : 1);
