import { describe, expect, it } from 'vitest';

import {
  cyclePicker,
  isSameChoice,
  pickedChoice,
  preselectPicker,
  type BrowserPicker,
} from '../../../src/tui/domain/browser-picker.ts';
import {
  BRAVE_CHOICE,
  BUNDLED_CHOICE,
} from '../../support/browser-fixtures.ts';
import { BROWSER_VIEWS } from '../../support/tui-fixtures.ts';

function picker(overrides: Partial<BrowserPicker> = {}): BrowserPicker {
  return {
    browsers: BROWSER_VIEWS,
    browserIndex: 0,
    profileIndex: 0,
    ...overrides,
  };
}

describe('src/tui/domain/browser-picker.ts', () => {
  describe('cyclePicker', () => {
    it('moves to the next browser and restarts the profile choice', () => {
      const next = cyclePicker(picker({ profileIndex: 2 }), 'browser', 1);
      expect(next).toMatchObject({ browserIndex: 1, profileIndex: 0 });
    });

    it('wraps around in both directions', () => {
      expect(
        cyclePicker(picker({ browserIndex: 1 }), 'browser', 1),
      ).toMatchObject({ browserIndex: 0 });
      expect(cyclePicker(picker(), 'browser', -1)).toMatchObject({
        browserIndex: 1,
      });
    });

    it('cycles the profiles of the chosen browser', () => {
      expect(cyclePicker(picker(), 'profile', 1)).toMatchObject({
        profileIndex: 1,
      });
      expect(
        cyclePicker(picker({ profileIndex: 2 }), 'profile', 1),
      ).toMatchObject({ profileIndex: 0 });
      expect(cyclePicker(picker(), 'profile', -1)).toMatchObject({
        profileIndex: 2,
      });
    });

    it('keeps any extra fields of the value it is given', () => {
      const result = cyclePicker({ ...picker(), tag: 'x' }, 'browser', 1);
      expect(result.tag).toBe('x');
    });

    it('does nothing while detecting or with no browsers', () => {
      const detecting = picker({ browsers: null });
      const none = picker({ browsers: [] });
      expect(cyclePicker(detecting, 'browser', 1)).toBe(detecting);
      expect(cyclePicker(none, 'profile', 1)).toBe(none);
    });
  });

  describe('pickedChoice', () => {
    it('returns the selected profile choice', () => {
      expect(pickedChoice(picker())).toEqual(BRAVE_CHOICE);
      expect(pickedChoice(picker({ browserIndex: 1 }))).toEqual(BUNDLED_CHOICE);
      expect(pickedChoice(picker({ profileIndex: 1 }))).toMatchObject({
        profileMode: 'copy-of-real',
        sourceProfile: 'Default',
      });
    });

    it('is null while detecting, with no browsers or an out of range index', () => {
      expect(pickedChoice(picker({ browsers: null }))).toBeNull();
      expect(pickedChoice(picker({ browsers: [] }))).toBeNull();
      expect(pickedChoice(picker({ profileIndex: 9 }))).toBeNull();
    });
  });

  describe('preselectPicker', () => {
    it('selects the browser by id and the profile by deep equal choice', () => {
      const copy = {
        browserId: 'brave',
        profileMode: 'copy-of-real',
        sourceProfile: 'Default',
      } as const;
      expect(preselectPicker(BROWSER_VIEWS, copy)).toEqual({
        browsers: BROWSER_VIEWS,
        browserIndex: 0,
        profileIndex: 1,
      });
      expect(preselectPicker(BROWSER_VIEWS, BUNDLED_CHOICE)).toMatchObject({
        browserIndex: 1,
        profileIndex: 0,
      });
    });

    it('falls back to the first profile when the profile is gone', () => {
      const gone = {
        ...BRAVE_CHOICE,
        profileMode: 'copy-of-real',
        sourceProfile: 'Profile 9',
      } as const;
      expect(preselectPicker(BROWSER_VIEWS, gone)).toMatchObject({
        browserIndex: 0,
        profileIndex: 0,
      });
    });

    it('falls back to the first option when the browser is not detected', () => {
      const missing = {
        browserId: 'opera',
        profileMode: 'managed',
        sourceProfile: null,
      } as const;
      expect(preselectPicker(BROWSER_VIEWS, missing)).toMatchObject({
        browserIndex: 0,
        profileIndex: 0,
      });
      expect(preselectPicker([], missing)).toMatchObject({
        browserIndex: 0,
        profileIndex: 0,
      });
    });
  });

  describe('isSameChoice', () => {
    it('compares browser, mode and profile', () => {
      expect(isSameChoice(BRAVE_CHOICE, { ...BRAVE_CHOICE })).toBe(true);
      expect(isSameChoice(BRAVE_CHOICE, BUNDLED_CHOICE)).toBe(false);
      expect(
        isSameChoice(BRAVE_CHOICE, {
          ...BRAVE_CHOICE,
          sourceProfile: 'Default',
        }),
      ).toBe(false);
      expect(
        isSameChoice(BRAVE_CHOICE, {
          ...BRAVE_CHOICE,
          profileMode: 'ephemeral',
        }),
      ).toBe(false);
    });
  });
});
