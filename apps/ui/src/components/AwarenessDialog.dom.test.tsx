// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scenarioFixtures } from '../state/fixtures';
import { AwarenessDialog } from './AwarenessDialog';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const assessment = scenarioFixtures.high.assessment;
const NOW = new Date('2026-10-03T10:10:00Z');

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" id="notify-review" onClick={() => setOpen(true)}>
        Review evidence
      </button>
      {open && (
        <AwarenessDialog assessment={assessment} fixture now={NOW} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

describe('AwarenessDialog interaction (jsdom)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const open = () => {
    act(() => {
      container.querySelector<HTMLButtonElement>('#notify-review')!.click();
    });
  };

  it('opens bound to the subject and observation time, with focus moved inside', () => {
    act(() => {
      root.render(<Harness />);
    });
    const invoker = container.querySelector<HTMLButtonElement>('#notify-review')!;
    act(() => invoker.focus());
    open();

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.textContent).toContain('demo-samples/eicar-simulation.txt');
    expect(dialog!.textContent).toContain('High risk');
    expect(dialog!.textContent).toContain('Complete');
    expect(dialog!.textContent).toContain('test-signatures fixture-1.0');
    expect(dialog!.textContent).toContain('fixture://evidence/eicar-marker');
    expect(dialog!.textContent).toContain('Fixture data');
    expect(dialog!.contains(document.activeElement)).toBe(true);
  });

  it('returns focus to the invoking control on close', () => {
    act(() => {
      root.render(<Harness />);
    });
    const invoker = container.querySelector<HTMLButtonElement>('#notify-review')!;
    act(() => invoker.focus());
    open();
    const close = container.querySelector<HTMLButtonElement>('[data-autofocus]')!;
    act(() => close.click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(invoker);
  });

  it('closes on Escape', () => {
    act(() => {
      root.render(<Harness />);
    });
    open();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('traps Tab within the dialog and wraps on the last focusable', () => {
    act(() => {
      root.render(<Harness />);
    });
    open();
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const focusables = dialog.querySelectorAll<HTMLElement>('button');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    act(() => last.focus());
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(first);
  });

  it('keeps agent-dependent actions visibly disabled with an explanation', () => {
    act(() => {
      root.render(<Harness />);
    });
    open();
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const disabled = dialog.querySelectorAll<HTMLButtonElement>('button[disabled]');
    expect(disabled.length).toBeGreaterThan(0);
    expect(dialog.textContent).toContain('Not connected');
  });
});
