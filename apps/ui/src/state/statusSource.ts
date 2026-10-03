import type { StatusMode } from '@sentinel/contracts/generated/StatusMode';
import type { StatusSnapshot } from '@sentinel/contracts/generated/StatusSnapshot';
import { isScenarioId, scenarioFixtures, type ScenarioId } from './fixtures';

/**
 * Status source seam. The UI renders only through this interface; the clearly
 * labeled fixture adapter is the default until Codex's authenticated agent
 * adapter (LOGIC-01 / #6, handshake in #19) lands. A live adapter must never
 * be fed fixture data, and fixture mode is displayed permanently.
 */
export type ConnectionState = 'fixture' | 'connecting' | 'live' | 'unavailable';

export interface StatusSource {
  readonly connection: ConnectionState;
  snapshot(): StatusSnapshot;
}

export class FixtureStatusSource implements StatusSource {
  readonly connection: ConnectionState = 'fixture';
  readonly mode: StatusMode = 'fixture';

  constructor(private scenario: ScenarioId) {}

  snapshot(): StatusSnapshot {
    return scenarioFixtures[this.scenario];
  }
}

export function defaultScenarioFromLocation(search: string): ScenarioId {
  const requested = new URLSearchParams(search).get('scenario');
  return isScenarioId(requested) ? requested : 'preview';
}
