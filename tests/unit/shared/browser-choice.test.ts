import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  BROWSER_IDS,
  BUNDLED_EPHEMERAL,
} from '../../../src/shared/domain/browser-choice.ts';
import type {
  BrowserChoice,
  BrowserId,
  ProfileMode,
} from '../../../src/shared/domain/browser-choice.ts';

describe('browser-choice', () => {
  it('lists the supported browsers with the bundled one last', () => {
    expect(BROWSER_IDS).toEqual([
      'brave',
      'chrome',
      'edge',
      'chromium',
      'vivaldi',
      'opera',
      'bundled',
    ]);
  });

  it('defaults to the bundled browser with a throwaway profile', () => {
    expect(BUNDLED_EPHEMERAL).toEqual({
      browserId: 'bundled',
      profileMode: 'ephemeral',
      sourceProfile: null,
    });
    expect(BROWSER_IDS).toContain(BUNDLED_EPHEMERAL.browserId);
  });

  it('derives the browser id type from the list', () => {
    expectTypeOf<BrowserId>().toEqualTypeOf<
      'brave' | 'chrome' | 'edge' | 'chromium' | 'vivaldi' | 'opera' | 'bundled'
    >();
  });

  it('keeps the three profile modes', () => {
    expectTypeOf<ProfileMode>().toEqualTypeOf<
      'managed' | 'copy-of-real' | 'ephemeral'
    >();
  });

  it('describes a choice as a browser, a mode and an optional source profile', () => {
    expectTypeOf<BrowserChoice>().toEqualTypeOf<{
      readonly browserId: BrowserId;
      readonly profileMode: ProfileMode;
      readonly sourceProfile: string | null;
    }>();
  });
});
