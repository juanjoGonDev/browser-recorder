import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertUnderFixtures,
  isRealBrowserEnabled,
  isHeadedAllowed,
} from '../../support/real-browser.ts';
import {
  BRAVE_LIKE_PROFILE,
  FIXTURE_PROFILES_ROOT,
} from '../../support/profile-fixtures.ts';

describe('tests/support/real-browser.ts', () => {
  describe('isRealBrowserEnabled', () => {
    it('is on only for the exact value 1', () => {
      expect(
        isRealBrowserEnabled({ BROWSER_RECORDER_REAL_BROWSER_TESTS: '1' }),
      ).toBe(true);
      expect(
        isRealBrowserEnabled({ BROWSER_RECORDER_REAL_BROWSER_TESTS: 'true' }),
      ).toBe(false);
      expect(isRealBrowserEnabled({})).toBe(false);
    });
  });

  describe('isHeadedAllowed', () => {
    it('is on only when the headed override is exactly 1', () => {
      expect(isHeadedAllowed({ BROWSER_RECORDER_HEADED_TESTS: '1' })).toBe(
        true,
      );
      expect(isHeadedAllowed({ BROWSER_RECORDER_HEADED_TESTS: '0' })).toBe(
        false,
      );
      expect(isHeadedAllowed({})).toBe(false);
    });
  });

  describe('assertUnderFixtures', () => {
    it('accepts a fixture profile and returns it', () => {
      expect(assertUnderFixtures(BRAVE_LIKE_PROFILE)).toBe(BRAVE_LIKE_PROFILE);
    });

    it('refuses a directory in the user home', () => {
      expect(() =>
        assertUnderFixtures(
          path.join('/Users/ana/Library/Application Support/BraveSoftware'),
        ),
      ).toThrow(/tests\/fixtures/);
    });

    it('refuses a path that climbs out of the fixtures', () => {
      expect(() =>
        assertUnderFixtures(path.join(FIXTURE_PROFILES_ROOT, '..', '..', '..')),
      ).toThrow(/tests\/fixtures/);
    });

    it('refuses a sibling whose name merely starts like the fixtures folder', () => {
      expect(() =>
        assertUnderFixtures(`${FIXTURE_PROFILES_ROOT}-other/brave`),
      ).toThrow(/tests\/fixtures/);
    });

    it('refuses the fixtures folder itself, which is not a profile', () => {
      expect(() => assertUnderFixtures(FIXTURE_PROFILES_ROOT)).toThrow(
        /tests\/fixtures/,
      );
    });
  });
});
