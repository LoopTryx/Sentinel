import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';
import ScanView from './views/ScanView';
import QuarantineView from './views/QuarantineView';

describe('integrated console capability boundaries', () => {
  it('preserves the console while explicitly labeling preview and no protection', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('SENTINEL');
    expect(html).toContain('Preview');
    expect(html).toContain('No live protection is installed');
    expect(html).not.toContain('LIVE PROTECTION ACTIVE');
    expect(html).not.toContain('All systems secure');
    expect(html).not.toContain('signature engine online');
    expect(html).toContain('SYNTHETIC SCENARIO');
  });
  it('does not offer scans through missing native commands', () => {
    const html = renderToStaticMarkup(<ScanView />);
    // The scan adapter is still absent: start is disabled and the page says so
    // explicitly. Rehearsal mode replays recorded scans but cannot inspect this device.
    expect(html).toContain('scan adapter');
    expect(html).toContain('Real inspection stays disabled until the adapter is connected');
    expect(html).toContain('disabled');
    expect(html).not.toContain('neutralizes what it catches');
  });
  it('distinguishes missing quarantine from an empty functioning vault', () => {
    const html = renderToStaticMarkup(<QuarantineView />);
    expect(html).toContain('unavailable');
    expect(html).not.toContain('AES-256 encrypted');
    expect(html).not.toContain('Vault empty');
  });
});
