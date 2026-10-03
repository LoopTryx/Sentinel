import { renderToStaticMarkup } from 'react-dom/server';
import { scenarioFixtures, type ScenarioId } from '../state/fixtures';
import { deriveThreatView } from '../state/threat';
import type { StatusState } from '../state/useStatus';
import { DashboardView } from '../views/DashboardView';

/** Static render of the dashboard for one fixture scenario (no effects). */
export function renderDashboard(scenario: ScenarioId): string {
  const now = new Date('2026-10-03T10:10:00Z');
  const snapshot = scenarioFixtures[scenario];
  const status: StatusState = {
    snapshot,
    view: deriveThreatView(snapshot, now),
    connection: 'fixture',
    scenario,
    setScenario: () => {},
    now,
  };
  const html = renderToStaticMarkup(<DashboardView status={status} />);
  return `<div class="app" data-tone="${status.view.tone}" data-mode="${status.view.mode}">${html}</div>`;
}
