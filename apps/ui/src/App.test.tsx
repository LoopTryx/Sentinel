import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('status fixture', () => {
  it('labels unavailable and untested capabilities without a protection claim', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Fixture preview');
    expect(html).toContain('Sentinel');
    expect(html).toContain('class="mark" aria-hidden="true">S</div>');
    expect(html).toContain('No live protection is installed');
    expect(html).toContain('File scanning');
    expect(html).toContain('USB storage gate');
    expect(html).toContain('Untested');
    expect(html).toContain('fixture-job-1');
    expect(html).toContain('Queued');
    expect(html).not.toContain('All protected');
  });
});
