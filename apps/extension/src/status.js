// Pure status logic for the Sentinel harness. No Chrome APIs may be imported
// here so node:test can exercise the state machine directly. Every state below
// must be observable at runtime; nothing may be reported as active protection.

export const FIXTURE_RULESET_ID = 'fixture_block';
export const FIXTURE_HOST = 'blocked.sentinel.invalid';
export const STATUS_SCHEMA_VERSION = 1;

export const FIXTURE_RULE_STATES = ['active', 'disabled', 'unknown'];
export const AGENT_STATES = ['unconfigured', 'unavailable', 'connected'];
export const SCAN_STATES = ['unavailable', 'partial', 'available'];
export const COVERAGE_STATES = ['fixture_only'];

export function computeStatus({ enabledRulesetIds, manifestPermissions, checkedAt }) {
  const permissions = Array.isArray(manifestPermissions) ? manifestPermissions : [];
  const fixtureState = deriveFixtureState(enabledRulesetIds);
  // The harness stage never registers a native messaging host; reporting the
  // agent as structurally unconfigured is the only truthful state until the
  // manifest gains a justified nativeMessaging permission.
  const agentState = permissions.includes('nativeMessaging') ? 'unavailable' : 'unconfigured';

  return {
    schemaVersion: STATUS_SCHEMA_VERSION,
    fixtureRule: {
      state: fixtureState,
      rulesetId: FIXTURE_RULESET_ID,
      host: FIXTURE_HOST,
    },
    agent: {
      state: agentState,
      detail:
        agentState === 'unconfigured'
          ? 'No native messaging host is configured for this harness stage'
          : 'Native messaging is configured but the agent is not responding',
    },
    scan: {
      state: agentState === 'connected' ? 'partial' : 'unavailable',
      detail: 'Page and download scanning require a connected native agent',
    },
    coverage: 'fixture_only',
    checkedAt,
  };
}

function deriveFixtureState(enabledRulesetIds) {
  if (!Array.isArray(enabledRulesetIds)) {
    return 'unknown';
  }
  return enabledRulesetIds.includes(FIXTURE_RULESET_ID) ? 'active' : 'disabled';
}

// Renders a status object as popup lines. Tones: 'ok' (verified active),
// 'off' (deliberately disabled), 'gap' (capability absent or unavailable).
export function statusLines(status) {
  if (!status || status.schemaVersion !== STATUS_SCHEMA_VERSION) {
    return [{ tone: 'gap', text: 'Harness status unavailable' }];
  }

  const fixtureText =
    status.fixtureRule.state === 'active'
      ? `Fixture rule active — blocks top-level visits to ${status.fixtureRule.host} only`
      : status.fixtureRule.state === 'disabled'
        ? `Fixture rule disabled — ${status.fixtureRule.host} is allowed again`
        : 'Fixture rule state unknown — the browser did not answer the ruleset query';

  return [
    {
      tone: status.fixtureRule.state === 'active' ? 'ok' : status.fixtureRule.state === 'disabled' ? 'off' : 'gap',
      text: fixtureText,
    },
    { tone: 'gap', text: `Native agent: ${status.agent.detail}` },
    { tone: 'gap', text: `Scanning: ${status.scan.detail}` },
    { tone: 'gap', text: 'Coverage: synthetic fixture only — this is not a Web Shield' },
  ];
}
