import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderDashboard } from './test/renderDashboard';

describe('dashboard states (static render)', () => {
  it('always labels fixture mode and separates risk, coverage and freshness', () => {
    const html = renderDashboard('preview');
    expect(html).toContain('data-mode="fixture"');
    expect(html).toContain('Unknown'); // risk axis
    expect(html).toContain('Unavailable'); // coverage axis
    expect(html).not.toContain('All protected');
    expect(html).not.toMatch(/You are protected/i);
  });

  it('clean complete checks still show capability gaps — never an aggregate protection claim', () => {
    const html = renderDashboard('clear');
    expect(html).toContain('Completed checks found nothing');
    expect(html).toContain('not a promise that this device is safe');
    expect(html).toContain('1 of 4 capabilities verified');
    expect(html).toContain('Untested');
    expect(html).not.toMatch(/\d+%\s*(protected|secure)/i);
  });

  it('a suspicious finding renders warn tone with review affordance', () => {
    const html = renderDashboard('suspicious');
    expect(html).toContain('Suspicious signal detected');
    expect(html).toContain('Review evidence');
    expect(html).toContain('data-tone="warn"');
  });

  it('a high-risk finding stays static and readable (danger tone, no flashing)', () => {
    const html = renderDashboard('high');
    expect(html).toContain('High-risk finding');
    expect(html).toContain('data-tone="danger"');
  });

  it('a stale reading is visibly expired, not fresh protection', () => {
    const html = renderDashboard('stale');
    expect(html).toContain('Expired');
    expect(html).toContain('The latest reading is expired');
  });

  it('offline scenario shows unavailable coverage, never clean', () => {
    const html = renderDashboard('offline');
    expect(html).toContain('Protection state is not known');
    expect(html).toContain('Unavailable');
    expect(html).toContain('0 of 4 capabilities verified');
  });
});

describe('app shell', () => {
  it('renders grouped navigation with all views and the status rail', async () => {
    const { App } = await import('./App');
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Dashboard');
    expect(html).toContain('Scan center');
    expect(html).toContain('USB autopsy');
    expect(html).toContain('Wi-Fi guard');
    expect(html).toContain('Academy');
    expect(html).toContain('Settings');
    expect(html).toContain('Latest risk');
    expect(html).toContain('Freshness');
    expect(html).toContain('Fixture');
    expect(html).toContain('Fixture preview — no live protection is installed');
  });
});
