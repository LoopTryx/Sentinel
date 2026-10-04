// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import PasswordManagerView from './views/PasswordManagerView';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
afterEach(async () => { await act(() => root.unmount()); document.body.innerHTML = ''; });
async function mount() { const host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(() => root.render(<PasswordManagerView/>)); return host; }
async function click(host: HTMLElement, text: string) { const button = [...host.querySelectorAll('button')].find(b => b.textContent === text)!; await act(() => button.click()); }
it('keeps real vault actions unavailable and clears sample selection on close', async () => {
  const host = await mount();
  expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Unlock vault')!.disabled).toBe(true);
  await click(host, 'Explore sample vault');
  await act(() => (host.querySelector('.pm-account') as HTMLButtonElement).click());
  expect(host.querySelector('[aria-label="Sample account details"]')!.textContent).toContain('Orbit Mail');
  expect(host.querySelector('[aria-label="Sample account details"]')!.textContent).toContain('Not stored');
  await click(host, 'Close sample'); await click(host, 'Explore sample vault');
  expect(host.querySelector('[aria-label="Sample account details"]')!.textContent).toContain('Choose an account');
});
it('filters attention accounts and invalidates details when a search changes', async () => {
  const host = await mount(); await click(host, 'Explore sample vault'); await click(host, 'Password health');
  expect(host.querySelectorAll('.pm-account')).toHaveLength(3);
  await act(() => (host.querySelector('.pm-account') as HTMLButtonElement).click());
  const input = host.querySelector('input')!;
  await act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'missing'); input.dispatchEvent(new Event('input', {bubbles:true})); });
  expect(host.querySelectorAll('.pm-account')).toHaveLength(0);
  expect(host.querySelector('[aria-label="Sample account details"]')!.textContent).not.toContain('Orbit Mail');
  expect(host.textContent).toContain('No matching samples');
});
