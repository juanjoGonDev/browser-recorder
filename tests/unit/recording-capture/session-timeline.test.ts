import { describe, expect, it } from 'vitest';
import type { SessionSignal } from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import type { Timeline } from '../../../src/recording-capture/application/session-timeline.ts';
import {
  applyDialogAnswer,
  applySignal,
  createTimeline,
} from '../../../src/recording-capture/application/session-timeline.ts';
import {
  clickPayload,
  domSignal,
  inputPayload,
  navigationSignal,
  pageClosedSignal,
  pageOpenedSignal,
} from '../../support/session-signals.ts';

const T0 = 1000;

function run(signals: readonly SessionSignal[]): Timeline {
  return signals.reduce(applySignal, createTimeline(T0));
}

function kinds(timeline: Timeline): string[] {
  return timeline.events.map((event) => event.kind);
}

describe('src/recording-capture/application/session-timeline.ts', () => {
  describe('offsets', () => {
    it('stamps the offset from the receipt time and the session start', () => {
      const timeline = run([domSignal(1500, clickPayload())]);
      expect(timeline.events).toMatchObject([{ kind: 'click', offsetMs: 500 }]);
    });

    it('places an event earlier by the age the page reported', () => {
      const timeline = run([domSignal(2000, clickPayload(300))]);
      expect(timeline.events).toMatchObject([{ offsetMs: 700 }]);
    });

    it('keeps offsets non-decreasing across a backward clock jump', () => {
      const timeline = run([
        domSignal(2000, clickPayload()),
        domSignal(1200, inputPayload('x')),
      ]);
      expect(timeline.events.map((event) => event.offsetMs)).toEqual([
        1000, 1000,
      ]);
    });
  });

  describe('navigation', () => {
    it('records a goto for a navigation no action preceded', () => {
      const timeline = run([navigationSignal(1100, 'https://a.test/')]);
      expect(timeline.events).toMatchObject([
        {
          kind: 'goto',
          url: 'https://a.test/',
          pageId: 'page1',
          offsetMs: 100,
        },
      ]);
    });

    it('records wait-for-url after a click and a goto without one', () => {
      const timeline = run([
        navigationSignal(1100, 'https://a.test/'),
        domSignal(5000, clickPayload()),
        navigationSignal(5400, 'https://a.test/next'),
        navigationSignal(9000, 'https://a.test/later'),
      ]);
      expect(kinds(timeline)).toEqual([
        'goto',
        'click',
        'wait-for-url',
        'goto',
      ]);
    });

    it('keeps goto and the redirect wait-for-url that follows it', () => {
      const timeline = run([
        navigationSignal(3000, 'https://a.test/start'),
        navigationSignal(3300, 'https://a.test/landing'),
      ]);
      expect(kinds(timeline)).toEqual(['goto', 'wait-for-url']);
    });

    it('records reload, back and forward from the entry index', () => {
      const timeline = run([
        navigationSignal(2000, 'https://a.test/a', { entryIndex: 1 }),
        navigationSignal(6000, 'https://a.test/b', { entryIndex: 2 }),
        navigationSignal(9000, 'https://a.test/a', {
          navigationType: 'traverse',
          entryIndex: 1,
        }),
        navigationSignal(12_000, 'https://a.test/b', {
          navigationType: 'traverse',
          entryIndex: 2,
        }),
        navigationSignal(15_000, 'https://a.test/b', {
          navigationType: 'reload',
          entryIndex: 2,
        }),
      ]);
      expect(kinds(timeline)).toEqual([
        'goto',
        'goto',
        'go-back',
        'go-forward',
        'reload',
      ]);
    });

    it('drops a same-URL push that no action caused', () => {
      const timeline = run([
        navigationSignal(2000, 'https://a.test/a'),
        navigationSignal(9000, 'https://a.test/a', { navigationType: 'push' }),
      ]);
      expect(kinds(timeline)).toEqual(['goto']);
    });

    it('does not count a hover or a scroll as the action behind a navigation', () => {
      const timeline = run([
        domSignal(5000, { kind: 'hover', ageMs: 0, description: 'menu' }),
        domSignal(5100, {
          kind: 'scroll',
          ageMs: 0,
          description: '',
          x: 0,
          y: 9,
        }),
        navigationSignal(5300, 'https://a.test/lazy'),
      ]);
      expect(kinds(timeline)).toEqual(['hover', 'scroll', 'goto']);
    });
  });

  describe('pages', () => {
    it('records a tab opened by an action with its opener', () => {
      const timeline = run([
        domSignal(5000, clickPayload()),
        pageOpenedSignal(5300, 'page2', 'https://a.test/popup'),
      ]);
      expect(timeline.events[1]).toEqual({
        kind: 'page-opened',
        offsetMs: 4300,
        pageId: 'page2',
        openerPageId: 'page1',
        cause: 'action',
        url: 'https://a.test/popup',
      });
    });

    it('records a tab nobody clicked for as opened by the user', () => {
      const timeline = run([pageOpenedSignal(9000, 'page2')]);
      expect(timeline.events).toMatchObject([{ cause: 'user' }]);
    });

    it('does not repeat the page-opened URL as a goto', () => {
      const timeline = run([
        pageOpenedSignal(9000, 'page2', 'https://a.test/popup'),
        navigationSignal(9100, 'https://a.test/popup', { pageId: 'page2' }),
      ]);
      expect(kinds(timeline)).toEqual(['page-opened']);
    });

    it('does record a different URL the new tab navigates to', () => {
      const timeline = run([
        pageOpenedSignal(9000, 'page2', 'about:blank'),
        navigationSignal(15_000, 'https://a.test/real', { pageId: 'page2' }),
      ]);
      expect(kinds(timeline)).toEqual(['page-opened', 'goto']);
    });

    it('records a closed tab while another stays open', () => {
      const timeline = run([
        pageOpenedSignal(2000, 'page2'),
        pageClosedSignal(9000, 'page2'),
      ]);
      expect(kinds(timeline)).toEqual(['page-opened', 'page-closed']);
      expect(timeline.hasEnded).toBe(false);
    });

    it('ends the timeline when the last page closes, without recording it', () => {
      const timeline = run([
        domSignal(2000, clickPayload()),
        pageClosedSignal(9000, 'page1'),
      ]);
      expect(kinds(timeline)).toEqual(['click']);
      expect(timeline.hasEnded).toBe(true);
    });
  });

  describe('coalescing', () => {
    it('merges typing into one fill', () => {
      const timeline = run([
        domSignal(2000, inputPayload('h')),
        domSignal(2100, inputPayload('he')),
        domSignal(2200, inputPayload('hey')),
      ]);
      expect(timeline.events).toMatchObject([
        { kind: 'fill', value: 'hey', offsetMs: 1200 },
      ]);
    });
  });

  describe('ignored signals', () => {
    it('leaves the timeline alone for a dialog or browser signal', () => {
      const timeline = run([
        { kind: 'browser-closed', receivedAt: 2000, pageId: 'page1' },
      ]);
      expect(timeline.events).toEqual([]);
    });
  });

  describe('applyDialogAnswer', () => {
    it('adds the answered dialog at the time of the answer', () => {
      const before = run([domSignal(2000, clickPayload())]);
      const after = applyDialogAnswer(before, {
        dialog: { pageId: 'page1', dialogType: 'prompt', message: 'Name?' },
        answer: { action: 'accept', promptText: 'abc' },
        nowMs: 3000,
      });
      expect(after.events[1]).toMatchObject({
        kind: 'dialog',
        offsetMs: 2000,
        action: 'accept',
        promptText: 'abc',
      });
    });
  });
});
