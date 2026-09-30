import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('manifest requests only fixture-blocking capability', async () => {
  const manifest = await json('manifest.json');
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'Sentinel Web Shield Harness');
  assert.deepEqual(manifest.permissions, ['declarativeNetRequest', 'storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background.service_worker, 'src/service-worker.js');
  assert.equal(manifest.action.default_popup, 'popup.html');
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

test('popup describes the narrow fixture coverage', async () => {
  const html = await readFile(new URL('popup.html', root), 'utf8');
  assert.match(html, /Fixture URL blocking active/);
  assert.match(html, /not yet connected to the Sentinel agent/i);
  assert.match(html, /No browsing history is collected/);
});
