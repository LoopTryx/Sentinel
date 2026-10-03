// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isDirectoryScanProgress } from './state/scanTypes';
import ScanView from './views/ScanView';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | undefined;
let host: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root!.unmount());
  root = undefined;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function findButton(text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text),
  );
  if (!button) throw new Error(`button not found: ${text}`);
  return button;
}

describe('Scan Center (issue-9 progress contract journeys)', () => {
  it('starts disabled and honest until rehearsal mode is switched on', () => {
    act(() => root!.render(<ScanView />));
    expect(findButton('START SCAN').disabled).toBe(true);
    expect(host.textContent).toContain('Partial coverage');
    expect(host.textContent).toContain('never renders a protection shield');
  });

  it('runs the benign rehearsal: indeterminate progress, string counters, no percent, no clean claim', async () => {
    act(() => root!.render(<ScanView />));
    await act(async () => {
      findButton('Off').click();
    });
    await act(async () => {
      findButton('START SCAN').click();
      vi.advanceTimersByTime(600);
    });
    expect(host.textContent).toContain('totals and percent are unknown');
    expect(host.textContent).not.toMatch(/\d+%/);
    // Advance through the recorded snapshots to the final one.
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
    }
    expect(host.textContent).toContain('Traversal complete');
    expect(host.textContent).toContain('Bytes read');
    // Counters render as text, and the finished benign run still shows partial coverage.
    expect(host.textContent).toContain('24576');
    expect(host.textContent).toContain('coverage');
    expect(host.textContent).not.toContain('Protected');
    expect(host.textContent).not.toContain('All clear');
  });

  it('cancel journey: sticky cancel, retained counters, incomplete never clean', async () => {
    act(() => root!.render(<ScanView />));
    await act(async () => {
      findButton('Off').click();
    });
    await act(async () => {
      findButton('START SCAN').click();
    });
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    const cancel = findButton('CANCEL');
    expect(cancel.disabled).toBe(false);
    await act(async () => {
      cancel.click();
      vi.advanceTimersByTime(700);
    });
    expect(host.textContent).toContain('Cancelled by user');
    expect(host.textContent).toContain('Traversal incomplete');
    expect(findButton('CANCEL').disabled).toBe(true);
    expect(host.textContent).toContain('incomplete');
  });

  it('gaps rehearsal: skips, errors and bounds render as an incomplete result', async () => {
    act(() => root!.render(<ScanView />));
    await act(async () => {
      findButton('Off').click();
    });
    const input = host.querySelector<HTMLInputElement>('input.input')!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, 'gaps');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      findButton('START SCAN').click();
    });
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
    }
    expect(host.textContent).toContain('Bound reached');
    expect(host.textContent).toContain('Not every entry was checked');
  });

  it('locks the selection and start while running (repeated-selection guard)', async () => {
    act(() => root!.render(<ScanView />));
    await act(async () => {
      findButton('Off').click();
    });
    const start = findButton('START SCAN');
    await act(async () => {
      start.click();
      vi.advanceTimersByTime(600);
    });
    expect(host.querySelector<HTMLInputElement>('input.input')!.disabled).toBe(true);
    expect(start.disabled).toBe(true);
    expect(host.textContent).toContain('RUNNING');
  });
});

describe('decimal-string counter decoder (u64 as string)', () => {
  it('accepts canonical unsigned decimal strings', () => {
    expect(isDirectoryScanProgress({
      stage: 'running', entriesVisited: '0', filesVisited: '2', filesChecked: '2',
      filesSkipped: '0', accessErrors: '0', engineFailures: '0', bytesRead: '6',
      traversalComplete: false, cancelled: false, limitReached: false,
    })).toBe(true);
  });
  it('rejects numeric JSON, signs and leading zeros', () => {
    const base = {
      stage: 'running', entriesVisited: '0', filesVisited: '2', filesChecked: '2',
      filesSkipped: '0', accessErrors: '0', engineFailures: '0', bytesRead: '6',
      traversalComplete: false, cancelled: false, limitReached: false,
    };
    expect(isDirectoryScanProgress({ ...base, bytesRead: 6 })).toBe(false);
    expect(isDirectoryScanProgress({ ...base, bytesRead: '+6' })).toBe(false);
    expect(isDirectoryScanProgress({ ...base, bytesRead: '06' })).toBe(false);
    expect(isDirectoryScanProgress({ ...base, stage: 'unknown' })).toBe(false);
  });
});
