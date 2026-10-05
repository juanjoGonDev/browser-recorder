import { describe, expect, it } from 'vitest';
import { appendEvent } from '../../../src/recording-capture/domain/coalesce-events.ts';
import type { Target } from '../../../src/shared/domain/locator.ts';
import type { RecordingEvent } from '../../../src/shared/domain/recording-event.ts';

function target(name: string, framePath: readonly string[] = []): Target {
  return {
    locator: { kind: 'label', text: name },
    nth: null,
    framePath,
    description: name,
  };
}

const inputA = target('A');
const inputB = target('B');

function fill(
  offsetMs: number,
  value: string,
  on: Target = inputA,
): RecordingEvent {
  return {
    kind: 'fill',
    offsetMs,
    pageId: 'page1',
    target: on,
    value,
    isSensitive: false,
  };
}

function click(offsetMs: number, on: Target = inputA): RecordingEvent {
  return {
    kind: 'click',
    offsetMs,
    pageId: 'page1',
    target: on,
    button: 'left',
    modifiers: [],
  };
}

function hover(offsetMs: number, on: Target): RecordingEvent {
  return { kind: 'hover', offsetMs, pageId: 'page1', target: on };
}

function waitFor(offsetMs: number, url: string): RecordingEvent {
  return { kind: 'wait-for-url', offsetMs, pageId: 'page1', url };
}

function appendAll(
  events: readonly RecordingEvent[],
): readonly RecordingEvent[] {
  return events.reduce<readonly RecordingEvent[]>(
    (all, next) => appendEvent(all, next),
    [],
  );
}

describe('src/recording-capture/domain/coalesce-events.ts', () => {
  it('appends an event with nothing to merge', () => {
    expect(appendEvent([], click(5))).toEqual([click(5)]);
  });

  it('does not change the list it was given', () => {
    const original = [fill(1, 'h')];
    appendEvent(original, fill(2, 'he'));
    expect(original).toEqual([fill(1, 'h')]);
  });

  describe('fill', () => {
    it('merges typing into one fill with the last value and the last offset', () => {
      expect(
        appendAll([fill(10, 'h'), fill(40, 'he'), fill(90, 'hey')]),
      ).toEqual([fill(90, 'hey')]);
    });

    it('keeps three fills when the target alternates', () => {
      const events = [
        fill(10, 'a', inputA),
        fill(20, 'b', inputB),
        fill(30, 'c', inputA),
      ];
      expect(appendAll(events)).toEqual(events);
    });

    it('does not merge the same target on another page or frame', () => {
      const otherPage = [
        fill(1, 'a'),
        { ...fill(2, 'b'), pageId: 'page2' as const },
      ];
      expect(appendAll(otherPage)).toEqual(otherPage);
      const inFrame = target('A', ['iframe']);
      const otherFrame = [fill(1, 'a'), fill(2, 'b', inFrame)];
      expect(appendAll(otherFrame)).toEqual(otherFrame);
    });

    it('does not merge across an event in between', () => {
      const events = [fill(1, 'a'), click(2, inputB), fill(3, 'ab')];
      expect(appendAll(events)).toEqual(events);
    });
  });

  describe('select, check and scroll', () => {
    it('keeps the last of consecutive selects on one target', () => {
      const select = (offsetMs: number, value: string): RecordingEvent => ({
        kind: 'select-option',
        offsetMs,
        pageId: 'page1',
        target: inputA,
        values: [value],
      });
      expect(appendAll([select(1, 'a'), select(2, 'b')])).toEqual([
        select(2, 'b'),
      ]);
    });

    it('keeps the last of consecutive scrolls on one target, window included', () => {
      const scroll = (
        offsetMs: number,
        y: number,
        on: Target | null,
      ): RecordingEvent => ({
        kind: 'scroll',
        offsetMs,
        pageId: 'page1',
        target: on,
        x: 0,
        y,
      });
      expect(appendAll([scroll(1, 100, null), scroll(2, 400, null)])).toEqual([
        scroll(2, 400, null),
      ]);
      const elementScrolls = [scroll(1, 100, inputA), scroll(2, 400, inputB)];
      expect(appendAll(elementScrolls)).toEqual(elementScrolls);
    });

    it('stores check then uncheck of the same box as two events', () => {
      const check = (offsetMs: number, isChecked: boolean): RecordingEvent => ({
        kind: 'check',
        offsetMs,
        pageId: 'page1',
        target: inputA,
        checked: isChecked,
      });
      const toggled = [check(1, true), check(2, false)];
      expect(appendAll(toggled)).toEqual(toggled);
      expect(appendAll([check(1, true), check(2, true)])).toEqual([
        check(2, true),
      ]);
    });
  });

  describe('dblclick', () => {
    const dblclick = (
      offsetMs: number,
      on: Target = inputA,
    ): RecordingEvent => ({
      kind: 'dblclick',
      offsetMs,
      pageId: 'page1',
      target: on,
      modifiers: [],
    });

    it('replaces the two clicks it is made of and keeps the first offset', () => {
      expect(appendAll([click(100), click(180), dblclick(185)])).toEqual([
        dblclick(100),
      ]);
    });

    it('replaces only the clicks that precede it on the same target', () => {
      expect(appendAll([click(50, inputB), click(100), dblclick(185)])).toEqual(
        [click(50, inputB), dblclick(100)],
      );
    });

    it('keeps a click that is more than 500 ms older', () => {
      expect(appendAll([click(100), dblclick(601)])).toEqual([
        click(100),
        dblclick(601),
      ]);
    });

    it('removes at most two clicks', () => {
      expect(
        appendAll([click(10), click(20), click(30), dblclick(40)]),
      ).toEqual([click(10), dblclick(20)]);
    });

    it('stands alone when no click precedes it', () => {
      expect(appendAll([dblclick(7)])).toEqual([dblclick(7)]);
    });
  });

  describe('navigation', () => {
    it('keeps the last of consecutive wait-for-url on one page', () => {
      expect(appendAll([waitFor(1, '/a'), waitFor(2, '/b')])).toEqual([
        waitFor(2, '/b'),
      ]);
    });

    it('keeps goto and its redirect wait-for-url', () => {
      const goto: RecordingEvent = {
        kind: 'goto',
        offsetMs: 1,
        pageId: 'page1',
        url: '/start',
      };
      const events = [goto, waitFor(2, '/landing')];
      expect(appendAll(events)).toEqual(events);
    });
  });

  describe('hover', () => {
    it('drops a hover right before a click on the same target', () => {
      expect(appendAll([hover(1, inputA), click(2, inputA)])).toEqual([
        click(2, inputA),
      ]);
    });

    it('keeps a hover on a menu before a click on one of its items', () => {
      const events = [hover(1, inputA), click(2, inputB)];
      expect(appendAll(events)).toEqual(events);
    });

    it('keeps the last of repeated hovers on the same target', () => {
      expect(appendAll([hover(1, inputA), hover(5, inputA)])).toEqual([
        hover(5, inputA),
      ]);
    });

    it('drops a hover right before a double click on the same target', () => {
      const dblclick: RecordingEvent = {
        kind: 'dblclick',
        offsetMs: 9,
        pageId: 'page1',
        target: inputA,
        modifiers: [],
      };
      expect(appendAll([hover(1, inputA), dblclick])).toEqual([dblclick]);
    });

    it('drops a hover right before a check on the same target', () => {
      const check: RecordingEvent = {
        kind: 'check',
        offsetMs: 4,
        pageId: 'page1',
        target: inputA,
        checked: true,
      };
      expect(appendAll([hover(1, inputA), check])).toEqual([check]);
    });

    it('drops a hover right before a fill on the same target', () => {
      expect(appendAll([hover(1, inputA), fill(3, 'x')])).toEqual([
        fill(3, 'x'),
      ]);
    });

    it('drops a hover right before a select on the same target', () => {
      const select: RecordingEvent = {
        kind: 'select-option',
        offsetMs: 6,
        pageId: 'page1',
        target: inputA,
        values: ['a'],
      };
      expect(appendAll([hover(1, inputA), select])).toEqual([select]);
    });

    it('keeps a hover before a fill, check or select on another target', () => {
      const check: RecordingEvent = {
        kind: 'check',
        offsetMs: 4,
        pageId: 'page1',
        target: inputB,
        checked: false,
      };
      for (const next of [fill(3, 'x', inputB), check]) {
        const events = [hover(1, inputA), next];
        expect(appendAll(events)).toEqual(events);
      }
    });

    it('keeps a hover before an action that does not act on the hovered element', () => {
      const press: RecordingEvent = {
        kind: 'press',
        offsetMs: 4,
        pageId: 'page1',
        target: inputA,
        key: 'Enter',
      };
      const events = [hover(1, inputA), press];
      expect(appendAll(events)).toEqual(events);
    });
  });
});
