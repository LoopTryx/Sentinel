import { useEffect, useMemo, useState } from 'react';
import type { StatusSnapshot } from '@sentinel/contracts/generated/StatusSnapshot';
import { isScenarioId, scenarioFixtures, type ScenarioId } from './fixtures';
import type { ConnectionState } from './statusSource';
import { deriveThreatView, type ThreatView } from './threat';

export interface StatusState {
  snapshot: StatusSnapshot;
  view: ThreatView;
  connection: ConnectionState;
  scenario: ScenarioId;
  setScenario: (scenario: ScenarioId) => void;
  now: Date;
}

/**
 * Fixture-backed status state for the shell. The initial render uses the
 * default scenario synchronously so server/static markup and first paint never
 * flash a loading state for fixture data. The connection axis is explicit so
 * the future live adapter (Codex LOGIC-01) drops in without view changes.
 */
export function useStatus(search?: string): StatusState {
  const initial = useMemo<ScenarioId>(() => {
    if (search !== undefined) {
      const requested = new URLSearchParams(search).get('scenario');
      return isScenarioId(requested) ? requested : 'preview';
    }
    return 'preview';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [scenario, setScenario] = useState<ScenarioId>(initial);
  const [now, setNow] = useState<Date>(() => new Date());

  // Freshness re-derives over time; one slow tick is enough for the 15-minute
  // staleness threshold and runs only while the page is visible.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const tick = () => setNow(new Date());
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') tick();
    }, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const snapshot = scenarioFixtures[scenario];
  return {
    snapshot,
    view: deriveThreatView(snapshot, now),
    connection: 'fixture',
    scenario,
    setScenario,
    now,
  };
}
