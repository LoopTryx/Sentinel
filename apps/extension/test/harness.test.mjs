import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const read = (path) => readFile(new URL(path, root), 'utf8');

test('manifest requests only fixture-blocking capability', async () => {
  const manifest = await json('manifest.json');
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'Sentinel Browser Companion');
  assert.deepEqual(manifest.permissions, ['declarativeNetRequest', 'storage', 'nativeMessaging', 'activeTab']);
  assert.deepEqual(manifest.host_permissions, ['http://127.0.0.1/*']);
  assert.deepEqual(manifest.optional_host_permissions,['http://127.0.0.1/*','http://*/*','https://*/*']);
  assert.equal(manifest.background.service_worker, 'src/service-worker.js');
  assert.equal(manifest.background.type, 'module');
  assert.equal(manifest.action.default_popup, 'popup.html'); // Native toolbar popup, including on restricted pages.
});

test('enabled packaged rule blocks only the synthetic fixture host', async () => {
  const manifest = await json('manifest.json');
  assert.equal(manifest.declarative_net_request.rule_resources[0].enabled, true);
  const rules = await json('rules/fixture-block.json');
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0].action, { type: 'block' });
  assert.equal(rules[0].condition.urlFilter, '||blocked.sentinel.invalid^');
  assert.deepEqual(rules[0].condition.resourceTypes, ['main_frame']);
});

test('service worker verifies ruleset state and toggles only the fixture ruleset', async () => {
  const source = await read('src/service-worker.js');
  assert.match(source, /getEnabledRulesets/);
  assert.match(source, /updateEnabledRulesets/);
  assert.match(source, /FIXTURE_RULESET_ID/);
  assert.match(source, /sender\.id !== chrome\.runtime\.id/);
  assert.match(source, /chrome\.storage\.local\.set/);
});

test('service worker recomputes on restart, validates toggles, and never reads stale snapshots', async () => {
  const source = await read('src/service-worker.js');
  assert.match(source, /^currentStatus\(\)\.catch\(/m);
  assert.match(source, /typeof message\.enabled === 'boolean'/);
  assert.match(source, /queueFixtureRuleUpdate/);
  assert.doesNotMatch(source, /storage\.local\.get/);
});

test('popup renders truthful states and a fixture-only toggle', async () => {
  const html = await read('popup.html');
  assert.match(html, /id="harness-status"/);
  assert.match(html, /id="fixture-toggle"/);
  assert.match(html, /blocked\.sentinel\.invalid/);
  assert.match(html, /Session accounts reset when the console closes/);
  assert.match(html, /Persistent encrypted storage, import, account editing and autofill are unavailable/);
  assert.match(html, /id="check-accounts"/);
  assert.doesNotMatch(html, /id="demo-lock"|id="generate-password"/);

  const script = await read('src/popup.js');
  assert.match(script, /statusLines/);
  assert.match(script, /harness_toggle_fixture/);
});

test('pure status module exports the runtime state machine', async () => {
  const source = await read('src/status.js');
  assert.match(source, /export function computeStatus/);
  assert.match(source, /export function statusLines/);
  assert.doesNotMatch(source, /chrome\./);
});
