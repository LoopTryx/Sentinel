import { describe, expect, it } from 'vitest';
import { scenarioFixtures } from './fixtures';
import { deriveNotifications } from './notifications';

const NOW = new Date('2026-10-03T10:10:00Z');

describe('deriveNotifications', () => {
  it('surfaces a high-risk finding bound to its subject and time', () => {
    const notes = deriveNotifications(scenarioFixtures.high, NOW);
    const risk = notes.find((n) => n.id === 'risk:fixture-assessment-high');
    expect(risk?.severity).toBe('danger');
    expect(risk?.subject).toBe('demo-samples/eicar-simulation.txt');
    expect(risk?.observedAt).toBe('2026-10-03T10:00:00Z');
  });

  it('deduplicates to one notification per assessment id', () => {
    const notes = deriveNotifications(scenarioFixtures.suspicious, NOW);
    const ids = notes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not notify for a current complete clean reading', () => {
    const notes = deriveNotifications(scenarioFixtures.clear, NOW);
    expect(notes.filter((n) => n.id.startsWith('risk:'))).toHaveLength(0);
    // The unavailable web_shield capability is still honestly visible.
    expect(notes.some((n) => n.id === 'capability:web_shield')).toBe(true);
  });

  it('surfaces expired freshness as its own warning', () => {
    const notes = deriveNotifications(scenarioFixtures.stale, NOW);
    expect(notes.some((n) => n.id === 'freshness:fixture-assessment-stale')).toBe(true);
  });

  it('sorts danger ahead of info', () => {
    const notes = deriveNotifications(scenarioFixtures.high, NOW);
    expect(notes[0]?.severity).toBe('danger');
  });
});
