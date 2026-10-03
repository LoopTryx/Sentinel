// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { AwarenessDialog } from './components/AwarenessDialog';
import { scenarioFixtures } from './state/fixtures';
import { deriveFreshness, deriveThreatView } from './state/threat';
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const NOW = new Date('2026-10-03T10:10:00Z');
describe('Codex published-head regressions', () => {
  it('does not call a future reading current', () => {
    const actual = deriveFreshness('2026-10-03T11:10:00Z', null, NOW);
    console.log('future timestamp freshness:', actual);
    expect(actual).not.toBe('current');
  });
  it('does not give an expired reading the positive shell tone', () => {
    const view = deriveThreatView(scenarioFixtures.stale, NOW);
    console.log('expired fixture:', view.freshness, view.tone);
    expect(view.freshness).toBe('expired');
    expect(view.tone).not.toBe('ok');
  });
  it('traps forward Tab from the final enabled control', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      act(() => root.render(<AwarenessDialog assessment={scenarioFixtures.high.assessment} fixture now={NOW} onClose={() => {}} />));
      const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
      const enabled = dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      expect(enabled.length).toBe(1);
      const lastEnabled = enabled[enabled.length - 1];
      act(() => lastEnabled.focus());
      expect(document.activeElement).toBe(lastEnabled);
      const key = new KeyboardEvent('keydown', {key:'Tab', bubbles:true, cancelable:true});
      act(() => lastEnabled.dispatchEvent(key));
      console.log('enabled controls:', enabled.length, 'Tab prevented:', key.defaultPrevented);
      expect(key.defaultPrevented).toBe(true);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
