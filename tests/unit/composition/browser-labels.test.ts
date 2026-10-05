import { describe, expect, it } from 'vitest';
import { browserLabelOf } from '../../../src/composition/browser-labels.ts';

describe('src/composition/browser-labels.ts', () => {
  it('names the catalogued browsers and the bundled one', () => {
    expect(browserLabelOf('brave')).toBe('Brave');
    expect(browserLabelOf('edge')).toBe('Microsoft Edge');
    expect(browserLabelOf('bundled')).toBe('Chromium (bundled)');
  });

  it('shows an unknown id as written', () => {
    expect(browserLabelOf('netscape')).toBe('netscape');
  });

  it('shortens an unknown id taken from an edited recording file', () => {
    const label = browserLabelOf('x'.repeat(200));
    expect(label).toBe(`${'x'.repeat(40)}...`);
  });
});
