// Repeatable pre-load smoke check for the unpacked harness. Verifies the
// dist/ folder exists and matches the source surface, then prints the exact
// Chrome load steps and the manual smoke checklist. Exits non-zero so CI and
// tools/verify.ps1 fail loudly on a stale or missing build.
import { readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');

const requiredFiles = [
  'src/floating-control.js',
  'src/ui-overlay.js',
  'src/ui-overlay.css',
  'src/overlay-controls.css',
  'src/readability.css',
  'src/assets/blue-ledge-v1.png',
  'src/assets/red-peeking-v1.png',
  'src/email/control.js',
  'src/email/popup.js',
  'src/email/runtime.js',
  'src/email/bootstrap.js',
  'src/email/banner.js',
  'src/assets/blue-investigate-v1.png',
  'src/assets/CabinetGrotesk-Variable.woff2',
  'third-party/CabinetGrotesk-FFL.txt',
  'src/assets/red-alert-v1.png',
  'src/email/link-guard.js',
  'src/email/scoring.js',
  'src/email/technical.js',
  'src/email/sender-store.js',
  'data/email-detector-config.js',
  'src/email/extraction.js',
  'src/email/providers/shared.js',
  'src/email/providers/gmail.js',
  'src/email/providers/outlook.js',
  'data/email-extraction-config.js',
  'src/message-detector.js',
  'data/message-detector-config.js',
  'manifest.json',
  'popup.html',
  'xray.html',
  'warning.html',
  'src/xray.css',
  'src/warning.js',
  'src/warning-page.css',
  'src/assets/red-shield-mascot.png',
  'src/navigation-policy.js',
  'src/navigation-controls.js',
  'src/whatsapp-control.js',
  'src/whatsapp-bootstrap.js',
  'src/whatsapp-inline.js',
  'src/whatsapp-popup.js',
  'data/badware-snapshot.js',
  'third-party/uassets-badware.txt',
  'third-party/uassets-LICENSE.txt',
  'src/omnibox.js',
  'src/xray.js',
  'rules/fixture-block.json',
  'src/service-worker.js',
  'src/popup.js',
  'src/status.js',
  'src/local-checks.js',
  'src/popup.css',
  'src/password-generator.js',
  'src/demo-transport.js',
  'src/demo-popup.js',
];

// Every dist file is a copy of a source file, including the runtime scripts:
// a stale service-worker.js or popup.js in dist must fail parity, not just
// static assets.
const mirroredFromSource = [
  'src/floating-control.js',
  'src/ui-overlay.js',
  'src/ui-overlay.css',
  'src/overlay-controls.css',
  'src/readability.css',
  'src/assets/blue-ledge-v1.png',
  'src/assets/red-peeking-v1.png',
  'src/email/extraction.js',
  'src/email/providers/shared.js',
  'src/email/providers/gmail.js',
  'src/email/providers/outlook.js',
  'data/email-extraction-config.js',
  'src/message-detector.js',
  'data/message-detector-config.js',
  'manifest.json',
  'popup.html',
  'xray.html',
  'warning.html',
  'src/xray.css',
  'src/warning.js',
  'src/warning-page.css',
  'src/assets/red-shield-mascot.png',
  'src/navigation-policy.js',
  'src/navigation-controls.js',
  'src/whatsapp-control.js',
  'src/whatsapp-bootstrap.js',
  'src/whatsapp-inline.js',
  'src/whatsapp-popup.js',
  'data/badware-snapshot.js',
  'third-party/uassets-badware.txt',
  'third-party/uassets-LICENSE.txt',
  'src/omnibox.js',
  'src/xray.js',
  'rules/fixture-block.json',
  'src/service-worker.js',
  'src/popup.js',
  'src/status.js',
  'src/local-checks.js',
  'src/popup.css',
  'src/password-generator.js',
  'src/demo-transport.js',
  'src/demo-popup.js',
];

function fail(message) {
  console.error(`smoke: FAIL — ${message}`);
  console.error('smoke: run "node apps/extension/scripts/build.mjs" and retry');
  process.exit(1);
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

for (const file of requiredFiles) {
  if (!(await isFile(resolve(dist, file)))) {
    fail(`dist/${file} is missing`);
  }
}

for (const file of mirroredFromSource) {
  const [source, built] = await Promise.all([
    readFile(resolve(root, file), 'utf8'),
    readFile(resolve(dist, file), 'utf8'),
  ]);
  if (source !== built) {
    fail(`dist/${file} differs from ${file} — the build is stale`);
  }
}

const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.json'), 'utf8'));
if (!manifest.declarative_net_request?.rule_resources?.some((r) => r.enabled && r.id === 'fixture_block')) {
  fail('built manifest does not enable the fixture_block ruleset');
}

console.log('smoke: dist/ parity checks passed for:');
for (const file of requiredFiles) {
  console.log(`  ${relative(root, resolve(dist, file))}`);
}
console.log(`
smoke: manual Chrome steps (developer load & smoke flow)
  1. Run: node apps/extension/scripts/build.mjs
  2. Open chrome://extensions, enable Developer mode
  3. "Load unpacked" -> select apps/extension/dist
  4. Open the popup -> expect "Fixture rule active" plus agent/scan unavailable lines
  5. Visit http://blocked.sentinel.invalid/ -> expect Chrome's ERR_BLOCKED_BY_CLIENT page
  6. Popup -> "Allow test domain" -> reload the page -> the request simply fails to resolve
     (.invalid never resolves; that is the expected allow behaviour, not an error)
  7. Popup -> "Block test domain" again -> rule is active on the next check
  8. chrome://extensions -> "service worker" -> inspect: a restart must not invent state;
     the popup after restart still reports the live ruleset state
  9. Unload the extension when finished
`);
