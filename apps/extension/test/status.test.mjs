import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  AGENT_STATES,
  COVERAGE_STATES,
  FIXTURE_RULE_STATES,
  FIXTURE_RULESET_ID,
  SCAN_STATES,
  STATUS_SCHEMA_VERSION,
  computeStatus,
  statusLines,
} from '../src/status.js';

const root = new URL('../', import.meta.url);
const checkedAt = '2026-09-30T12:00:00.000Z';

test('ruleset enabled at runtime reports the fixture rule as active', () => {
  const status = computeStatus({
    enabledRulesetIds: [FIXTURE_RULESET_ID],
    manifestPermissions: ['declarativeNetRequest', 'storage'],
    checkedAt,
  });
  assert.equal(status.fixtureRule.state, 'active');
  assert.equal(status.fixtureRule.host, 'blocked.sentinel.invalid');
  assert.equal(status.agent.state, 'unconfigured');
  assert.equal(status.scan.state, 'unavailable');
  assert.equal(status.coverage, 'fixture_only');
  assert.equal(status.checkedAt, checkedAt);
  assert.equal(status.schemaVersion, STATUS_SCHEMA_VERSION);
});

test('ruleset disabled reports disabled, never a fake active state', () => {
  const status = computeStatus({
    enabledRulesetIds: [],
    manifestPermissions: ['declarativeNetRequest', 'storage'],
    checkedAt,
  });
  assert.equal(status.fixtureRule.state, 'disabled');
  const lines = statusLines(status);
  assert.match(lines[0].text, /disabled/);
  assert.match(lines[0].text, /allowed again/);
  assert.equal(lines[0].tone, 'off');
});

test('failed ruleset query reports unknown instead of guessing', () => {
  const status = computeStatus({
    enabledRulesetIds: null,
    manifestPermissions: ['declarativeNetRequest', 'storage'],
    checkedAt,
  });
  assert.equal(status.fixtureRule.state, 'unknown');
  assert.equal(statusLines(status)[0].tone, 'gap');
  assert.match(statusLines(status)[0].text, /unknown/);
});

test('agent is unconfigured while the manifest lacks nativeMessaging', () => {
  const status = computeStatus({
    enabledRulesetIds: [FIXTURE_RULESET_ID],
    manifestPermissions: ['declarativeNetRequest', 'storage'],
    checkedAt,
  });
  assert.equal(status.agent.state, 'unconfigured');
  assert.match(status.agent.detail, /No native messaging host is configured/);
  assert.equal(status.scan.state, 'unavailable');
});

test('nativeMessaging permission without a responding agent reports unavailable, not connected', () => {
  const status = computeStatus({
    enabledRulesetIds: [FIXTURE_RULESET_ID],
    manifestPermissions: ['declarativeNetRequest', 'storage', 'nativeMessaging'],
    checkedAt,
  });
  assert.equal(status.agent.state, 'unavailable');
  assert.equal(status.scan.state, 'unavailable');
});

test('non-array permissions are rejected defensively', () => {
  const status = computeStatus({
    enabledRulesetIds: [FIXTURE_RULESET_ID],
    manifestPermissions: null,
    checkedAt,
  });
  assert.equal(status.agent.state, 'unconfigured');
});

test('status lines never claim protection, connection, or more than fixture coverage', () => {
  const active = computeStatus({
    enabledRulesetIds: [FIXTURE_RULESET_ID],
    manifestPermissions: ['declarativeNetRequest', 'storage'],
    checkedAt,
  });
  for (const line of statusLines(active)) {
    assert.doesNotMatch(line.text, /protect(?:ed|ion)|secure|\b(?:is|are) connected\b|safe\b/i);
    assert.doesNotMatch(line.text, /all (?:websites|sites|downloads)/i);
  }
  const coverageLine = statusLines(active).find((line) => /Coverage/.test(line.text));
  assert.match(coverageLine.text, /synthetic fixture only/);
  assert.match(coverageLine.text, /not a Web Shield/);
});

test('status lines for a missing or foreign schema fall back to unknown', () => {
  assert.equal(statusLines(null)[0].text, 'Harness status unavailable');
  assert.equal(statusLines({ schemaVersion: 999 })[0].text, 'Harness status unavailable');
});

test('state vocabularies stay closed and documented', () => {
  const status = computeStatus({
    enabledRulesetIds: [FIXTURE_RULESET_ID],
    manifestPermissions: ['declarativeNetRequest', 'storage'],
    checkedAt,
  });
  assert.ok(FIXTURE_RULE_STATES.includes(status.fixtureRule.state));
  assert.ok(AGENT_STATES.includes(status.agent.state));
  assert.ok(SCAN_STATES.includes(status.scan.state));
  assert.ok(COVERAGE_STATES.includes(status.coverage));
});

test('manifest stays minimal: no nativeMessaging, no host permissions', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  assert.ok(!manifest.permissions.includes('nativeMessaging'));
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.permissions, ['declarativeNetRequest', 'storage']);
});
