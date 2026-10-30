import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';
import {ThreatProvider} from './state';
import ScanView from './views/ScanView';
import QuarantineView from './views/QuarantineView';

describe('integrated console capability boundaries', () => {
  it('shows disconnected status without inventing protection or scenario widgets', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('SENTINEL');
    expect(html).not.toContain('Connected · partial coverage');
    expect(html).toContain('Processor unavailable');
    expect(html).not.toContain('LIVE PROTECTION ACTIVE');
    expect(html).not.toContain('All systems secure');
    expect(html).not.toContain('signature engine online');
    expect(html).not.toContain('SYNTHETIC SCENARIO');
    expect(html).not.toContain('Threat Log');
    expect(html).not.toContain('DEMO ACCOUNTS');
    expect(html.indexOf('aria-label="Sentinel AI"')).toBeGreaterThan(html.indexOf('aria-label="Quarantine"'));
  });
  it('keeps the ribbon after the main area and removes the sidebar footer',()=>{
    const html=renderToStaticMarkup(<App/>);
    expect(html).toContain('font-size:18px');expect(html).toContain('stroke-width="30"');
    expect(html).toContain('</main><footer class="desktop-ribbon">');expect(html).not.toContain('sidebar-footer');
    expect(html).not.toContain('THINK · PROTECT · DEFEND');
  });
  it('does not offer scans through missing native commands', () => {
    const html = renderToStaticMarkup(<ThreatProvider><ScanView /></ThreatProvider>);
    expect(html).toContain('unavailable');
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
