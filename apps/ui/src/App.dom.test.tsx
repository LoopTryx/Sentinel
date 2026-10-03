// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe('App shell interaction (jsdom)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<App />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('navigates with buttons that keep aria-current in sync', () => {
    const scanNav = Array.from(container.querySelectorAll<HTMLButtonElement>('.nav-link')).find(
      (b) => b.textContent === 'Scan center',
    )!;
    act(() => scanNav.click());
    expect(scanNav.getAttribute('aria-current')).toBe('page');
    expect(container.textContent).toContain('Planned, not connected yet');
    // The placeholder is honest about its dependency instead of a dead control.
    expect(container.textContent).toContain('#6/#7/#9');
  });

  it('opens the awareness dialog from the dashboard and restores focus', () => {
    const review = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent === 'Review evidence',
    )!;
    act(() => review.focus());
    act(() => review.click());
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-autofocus]')!.click();
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(review);
  });

  it('scenario switcher re-renders the derived threat state and keeps the fixture banner', () => {
    const scenarioButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent === 'High-risk finding',
    )!;
    act(() => scenarioButton.click());
    expect(container.querySelector('.app')!.getAttribute('data-tone')).toBe('danger');
    expect(container.textContent).toContain('Fixture preview — no live protection is installed');
    expect(scenarioButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('dismiss moves a notification behind a collapsed affordance', () => {
    const scenarioButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent === 'High-risk finding',
    )!;
    act(() => scenarioButton.click());
    const dismiss = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent === 'Dismiss',
    )!;
    act(() => dismiss.click());
    expect(container.textContent).toContain('Dismissed (1)');
  });

  it('settings switches drive the reduced-motion/transparency surfaces', () => {
    const settingsNav = Array.from(container.querySelectorAll<HTMLButtonElement>('.nav-link')).find(
      (b) => b.textContent === 'Settings',
    )!;
    act(() => settingsNav.click());
    const motionSwitch = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="switch"]'),
    )[0]!;
    act(() => motionSwitch.click());
    expect(container.querySelector('.app')!.getAttribute('data-motion')).toBe('reduced');
    expect(motionSwitch.getAttribute('aria-checked')).toBe('true');
  });
});
