import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('status fixture', () => {
  it('labels unavailable and untested capabilities without a protection claim', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Fixture preview');
    expect(html).toContain('No live protection is installed');
    expect(html).toContain('File scanning');
    expect(html).toContain('USB storage gate');
    expect(html).toContain('Untested');
    expect(html).not.toContain('All protected');
  });
});
