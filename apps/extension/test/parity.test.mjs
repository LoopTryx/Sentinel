// Negative parity tests for scripts/smoke.mjs. Each test builds the
// extension into an isolated temporary fixture (never the developer's real
// dist/), tampers exactly one built runtime script, and requires smoke.mjs
// to exit non-zero with a stale-build message. This is the regression test
// for the review finding that a stale dist/src/service-worker.js stub
// previously passed the parity gate.
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COPIED_ENTRIES = ['manifest.json', 'popup.html', 'field-vault.html', 'xray.html', 'warning.html', 'continue.html', 'data', 'third-party', 'rules', 'src', 'scripts'];
const RUN_TIMEOUT_MS = 30000;

function runNode(scriptRelative, cwd) {
  return new Promise((resolvePromise) => {
    execFile(
      process.execPath,
      [scriptRelative,...(scriptRelative.endsWith('build.mjs')?['--reuse-shared-ui']:[])],
      { cwd, timeout: RUN_TIMEOUT_MS },
      (error, stdout, stderr) => {
        resolvePromise({ code: error ? (error.code ?? 1) : 0, stdout, stderr });
      }
    );
  });
}

async function makeFixture() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'sentinel-smoke-'));
  for (const entry of COPIED_ENTRIES) {
    await cp(join(extensionRoot, entry), join(fixtureRoot, entry), { recursive: true });
  }
  return fixtureRoot;
}

async function buildAndSmoke(fixtureRoot) {
  const build = await runNode(join('scripts', 'build.mjs'), fixtureRoot);
  assert.equal(build.code, 0, `build failed in fixture: ${build.stderr}`);
  return runNode(join('scripts', 'smoke.mjs'), fixtureRoot);
}

test('pristine fixture build passes smoke parity', async () => {
  const fixtureRoot = await makeFixture();
  try {
    const smoke = await buildAndSmoke(fixtureRoot);
    assert.equal(smoke.code, 0, `expected smoke to pass: ${smoke.stderr || smoke.stdout}`);
    assert.match(smoke.stdout, /parity checks passed/);
    assert.match(smoke.stdout, /src[\\/]service-worker\.js/);
    assert.match(smoke.stdout, /src[\\/]popup\.js/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('stale dist service worker fails smoke with a nonzero exit', async () => {
  const fixtureRoot = await makeFixture();
  try {
    await buildAndSmoke(fixtureRoot);
    await writeFile(join(fixtureRoot, 'dist', 'src', 'service-worker.js'), '// stale stub');
    const smoke = await runNode(join('scripts', 'smoke.mjs'), fixtureRoot);
    assert.notEqual(smoke.code, 0, 'smoke must fail on a stale dist service-worker.js');
    assert.match(smoke.stderr, /service-worker\.js/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('stale dist popup script fails smoke with a nonzero exit', async () => {
  const fixtureRoot = await makeFixture();
  try {
    await buildAndSmoke(fixtureRoot);
    await writeFile(join(fixtureRoot, 'dist', 'src', 'popup.js'), '// stale stub');
    const smoke = await runNode(join('scripts', 'smoke.mjs'), fixtureRoot);
    assert.notEqual(smoke.code, 0, 'smoke must fail on a stale dist popup.js');
    assert.match(smoke.stderr, /popup\.js/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('stale dist status module still fails smoke (regression guard)', async () => {
  const fixtureRoot = await makeFixture();
  try {
    await buildAndSmoke(fixtureRoot);
    await writeFile(join(fixtureRoot, 'dist', 'src', 'status.js'), '// stale stub');
    const smoke = await runNode(join('scripts', 'smoke.mjs'), fixtureRoot);
    assert.notEqual(smoke.code, 0, 'smoke must fail on a stale dist status.js');
    assert.match(smoke.stderr, /status\.js/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
