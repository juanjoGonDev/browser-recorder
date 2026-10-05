import { describe, expect, it } from 'vitest';

import { describeBrowser } from '../../../src/tui/render/browser-summary.ts';
import {
  BRAVE_CHOICE,
  BUNDLED_CHOICE,
} from '../../support/browser-fixtures.ts';

describe('src/tui/render/browser-summary.ts', () => {
  it('names the browser and the profile mode', () => {
    expect(describeBrowser(BRAVE_CHOICE)).toBe('Brave · managed');
    expect(describeBrowser(BUNDLED_CHOICE)).toBe(
      'Chromium (bundled) · ephemeral',
    );
  });

  it('names the copied profile for a copy of the real one', () => {
    expect(
      describeBrowser({
        browserId: 'chrome',
        profileMode: 'copy-of-real',
        sourceProfile: 'Profile 2',
      }),
    ).toBe('Chrome · copy of Profile 2');
    expect(
      describeBrowser({
        browserId: 'edge',
        profileMode: 'copy-of-real',
        sourceProfile: null,
      }),
    ).toBe('Edge · copy of the real profile');
  });

  it('shows an unknown browser id as unknown instead of echoing it', () => {
    expect(
      describeBrowser({
        browserId: '\u001b[2Jevil' as 'brave',
        profileMode: 'managed',
        sourceProfile: null,
      }),
    ).toBe('unknown browser · managed');
  });

  it('strips control characters from the profile directory', () => {
    expect(
      describeBrowser({
        browserId: 'brave',
        profileMode: 'copy-of-real',
        sourceProfile: 'Pro\u001bfile',
      }),
    ).toBe('Brave · copy of Pro·file');
  });
});
