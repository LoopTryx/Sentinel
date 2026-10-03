import { describe, expect, it } from 'vitest';
import { scenarioFixtures } from './fixtures';
import {
  deriveFreshness,
  deriveThreatView,
  deriveTone,
  rollupCapabilities,
  STALE_AFTER_MS,
} from './threat';

const NOW = new Date('2026-10-03T10:10:00Z');

describe('deriveFreshness', () => {
  it('is unknown without a reading', () => {
    expect(deriveFreshness(null, null, NOW)).toBe('unknown');
  });
  it('is unknown for an unparseable timestamp', () => {
    expect(deriveFreshness('not-a-date', null, NOW)).toBe('unknown');
  });
  it('is current within the staleness threshold', () => {
    const observed = new Date(NOW.getTime() - STALE_AFTER_MS + 1000).toISOString();
    expect(deriveFreshness(observed, null, NOW)).toBe('current');
  });
  it('is stale beyond the threshold', () => {
    const observed = new Date(NOW.getTime() - STALE_AFTER_MS - 1000).toISOString();
    expect(deriveFreshness(observed, null, NOW)).toBe('stale');
  });
  it('is expired past the expiry even when the reading is recent', () => {
    const observed = new Date(NOW.getTime() - 60_000).toISOString();
    const expired = new Date(NOW.getTime() - 30_000).toISOString();
    expect(deriveFreshness(observed, expired, NOW)).toBe('expired');
  });
  it('stays current when expiry is in the future', () => {
    const observed = new Date(NOW.getTime() - 60_000).toISOString();
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    expect(deriveFreshness(observed, future, NOW)).toBe('current');
  });
});

describe('deriveTone', () => {
  it('maps risk high to danger regardless of coverage', () => {
    expect(deriveTone('high', 'complete')).toBe('danger');
    expect(deriveTone('high', 'unavailable')).toBe('danger');
  });
  it('maps suspicious to warn', () => {
    expect(deriveTone('suspicious', 'complete')).toBe('warn');
  });
  it('never shows ok for a clean result with incomplete coverage', () => {
    expect(deriveTone('none_observed', 'partial')).toBe('unknown');
    expect(deriveTone('none_observed', 'unavailable')).toBe('unknown');
  });
  it('shows ok only for a clean result with complete coverage', () => {
    expect(deriveTone('none_observed', 'complete')).toBe('ok');
  });
  it('keeps unknown risk strictly uncertain', () => {
    expect(deriveTone('unknown', 'complete')).toBe('unknown');
    expect(deriveTone('unknown', 'unavailable')).toBe('unknown');
  });
});

describe('deriveThreatView', () => {
  it('fixture mode stays visible and never produces a green tone for the shared preview', () => {
    const view = deriveThreatView(scenarioFixtures.preview, NOW);
    expect(view.mode).toBe('fixture');
    expect(view.tone).toBe('unknown');
    expect(view.risk).toBe('unknown');
    expect(view.coverage).toBe('unavailable');
  });
  it('stale scenario derives an expired freshness without hiding the clean risk', () => {
    const view = deriveThreatView(scenarioFixtures.stale, NOW);
    expect(view.risk).toBe('none_observed');
    expect(view.tone).toBe('ok');
    expect(view.freshness).toBe('expired');
  });
  it('every scenario stays in fixture mode', () => {
    for (const snapshot of Object.values(scenarioFixtures)) {
      expect(snapshot.mode).toBe('fixture');
    }
  });
});

describe('rollupCapabilities', () => {
  it('counts each capability state separately', () => {
    const rollup = rollupCapabilities(scenarioFixtures.clear);
    expect(rollup.total).toBe(4);
    expect(rollup.proven).toBe(1);
    expect(rollup.untested).toBe(2);
    expect(rollup.unavailable).toBe(1);
  });
});
