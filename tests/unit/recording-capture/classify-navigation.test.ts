import { describe, expect, it } from 'vitest';
import type {
  NavigationHistory,
  NavigationInput,
} from '../../../src/recording-capture/domain/classify-navigation.ts';
import {
  classifyNavigation,
  classifyPageOpenCause,
} from '../../../src/recording-capture/domain/classify-navigation.ts';

const SAME_URL = 'https://a.test/x';

const idle: NavigationHistory = {
  lastActionAtMs: null,
  lastNavigationAtMs: null,
  currentUrl: SAME_URL,
  previousEntryIndex: 3,
};

function navigation(overrides: Partial<NavigationInput>): NavigationInput {
  return {
    navigationType: 'navigate',
    url: 'https://a.test/y',
    entryIndex: 4,
    nowMs: 10_000,
    ...overrides,
  };
}

describe('src/recording-capture/domain/classify-navigation.ts', () => {
  describe('a navigation with no preceding action', () => {
    it('is a goto', () => {
      expect(classifyNavigation(navigation({}), idle)).toEqual([
        { kind: 'goto', url: 'https://a.test/y' },
      ]);
    });

    it('is a goto to the same URL as well, it is never dropped', () => {
      const input = navigation({ url: 'https://a.test/x' });
      expect(classifyNavigation(input, idle)).toEqual([
        { kind: 'goto', url: 'https://a.test/x' },
      ]);
    });

    it('treats an unknown navigation type as a goto', () => {
      const input = navigation({ navigationType: 'unknown' });
      expect(classifyNavigation(input, idle)).toEqual([
        { kind: 'goto', url: 'https://a.test/y' },
      ]);
    });
  });

  describe('an action-triggered navigation', () => {
    it('waits for the URL when the action was under 1000 ms ago', () => {
      const history = { ...idle, lastActionAtMs: 9_001 };
      expect(classifyNavigation(navigation({}), history)).toEqual([
        { kind: 'wait-for-url', url: 'https://a.test/y' },
      ]);
    });

    it('is a goto once the action is 1000 ms old', () => {
      const history = { ...idle, lastActionAtMs: 9_000 };
      expect(classifyNavigation(navigation({}), history)).toEqual([
        { kind: 'goto', url: 'https://a.test/y' },
      ]);
    });

    it('keeps a same-URL push after an action', () => {
      const history = { ...idle, lastActionAtMs: 9_500 };
      const input = navigation({ navigationType: 'push', url: SAME_URL });
      expect(classifyNavigation(input, history)).toEqual([
        { kind: 'wait-for-url', url: 'https://a.test/x' },
      ]);
    });
  });

  describe('a redirect', () => {
    it('waits for the URL when the page navigated under 1500 ms ago', () => {
      const history = { ...idle, lastNavigationAtMs: 8_501 };
      expect(classifyNavigation(navigation({}), history)).toEqual([
        { kind: 'wait-for-url', url: 'https://a.test/y' },
      ]);
    });

    it('is a goto once the previous navigation is 1500 ms old', () => {
      const history = { ...idle, lastNavigationAtMs: 8_500 };
      expect(classifyNavigation(navigation({}), history)).toEqual([
        { kind: 'goto', url: 'https://a.test/y' },
      ]);
    });

    it('is not a redirect when an action happened after the previous navigation', () => {
      const history = {
        ...idle,
        lastNavigationAtMs: 8_800,
        lastActionAtMs: 8_900,
      };
      const input = navigation({ nowMs: 10_000 });
      expect(classifyNavigation(input, history)).toEqual([
        { kind: 'goto', url: 'https://a.test/y' },
      ]);
    });
  });

  describe('reload, back and forward', () => {
    it('records a reload even right after an action', () => {
      const history = { ...idle, lastActionAtMs: 9_900 };
      const input = navigation({ navigationType: 'reload', url: SAME_URL });
      expect(classifyNavigation(input, history)).toEqual([{ kind: 'reload' }]);
    });

    it.each(['back_forward', 'traverse'] as const)(
      'records go-back for a %s one entry back',
      (navigationType) => {
        const input = navigation({ navigationType, entryIndex: 2 });
        expect(classifyNavigation(input, idle)).toEqual([{ kind: 'go-back' }]);
      },
    );

    it('records go-forward one entry forward, with no wait-for-url beside it', () => {
      const history = { ...idle, lastActionAtMs: 9_900 };
      const input = navigation({ navigationType: 'traverse', entryIndex: 4 });
      expect(classifyNavigation(input, history)).toEqual([
        { kind: 'go-forward' },
      ]);
    });

    it('repeats go-back for a multi-entry jump', () => {
      const input = navigation({ navigationType: 'traverse', entryIndex: 0 });
      expect(classifyNavigation(input, idle)).toEqual([
        { kind: 'go-back' },
        { kind: 'go-back' },
        { kind: 'go-back' },
      ]);
    });

    it('repeats go-forward for a multi-entry jump', () => {
      const input = navigation({ navigationType: 'traverse', entryIndex: 5 });
      expect(classifyNavigation(input, idle)).toEqual([
        { kind: 'go-forward' },
        { kind: 'go-forward' },
      ]);
    });

    it.each([
      [
        'an unknown entry index',
        navigation({ navigationType: 'traverse', entryIndex: null }),
        idle,
      ],
      [
        'an unknown previous index',
        navigation({ navigationType: 'traverse' }),
        { ...idle, previousEntryIndex: null },
      ],
      [
        'no index change',
        navigation({ navigationType: 'back_forward', entryIndex: 3 }),
        idle,
      ],
    ])('falls back to goto with %s', (_label, input, history) => {
      expect(classifyNavigation(input, history)).toEqual([
        { kind: 'goto', url: 'https://a.test/y' },
      ]);
    });
  });

  describe('a same-document navigation without an action', () => {
    it.each(['push', 'replace'] as const)(
      'drops a same-URL %s',
      (navigationType) => {
        const input = navigation({ navigationType, url: SAME_URL });
        expect(classifyNavigation(input, idle)).toEqual([]);
      },
    );

    it('keeps a push to a different URL as a goto', () => {
      const input = navigation({ navigationType: 'push' });
      expect(classifyNavigation(input, idle)).toEqual([
        { kind: 'goto', url: 'https://a.test/y' },
      ]);
    });
  });

  describe('classifyPageOpenCause', () => {
    it('is an action when one happened under 1000 ms ago', () => {
      expect(classifyPageOpenCause(9_500, 10_000)).toBe('action');
    });

    it('is the user when the last action is older or there was none', () => {
      expect(classifyPageOpenCause(9_000, 10_000)).toBe('user');
      expect(classifyPageOpenCause(null, 10_000)).toBe('user');
    });
  });
});
