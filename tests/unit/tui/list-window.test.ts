import { describe, expect, it } from 'vitest';

import {
  followRange,
  moveCursor,
  pageCursor,
  refitCursor,
  visibleRange,
} from '../../../src/tui/domain/list-window.ts';

describe('src/tui/domain/list-window.ts', () => {
  const start = { selected: 0, top: 0 };

  it('moves down twice and up once to land on the second entry', () => {
    const down1 = moveCursor(start, 1, { count: 3, rows: 10 });
    const down2 = moveCursor(down1, 1, { count: 3, rows: 10 });
    const up1 = moveCursor(down2, -1, { count: 3, rows: 10 });
    expect(down2.selected).toBe(2);
    expect(up1.selected).toBe(1);
  });

  it('never wraps out of bounds', () => {
    expect(moveCursor(start, -1, { count: 3, rows: 10 }).selected).toBe(0);
    expect(
      moveCursor({ selected: 2, top: 0 }, 1, { count: 3, rows: 10 }).selected,
    ).toBe(2);
  });

  it('keeps an empty list on zero', () => {
    expect(moveCursor(start, 1, { count: 0, rows: 10 })).toEqual({
      selected: 0,
      top: 0,
    });
  });

  it('scrolls so the selection stays inside the window', () => {
    let cursor = start;
    for (let step = 0; step < 7; step += 1)
      cursor = moveCursor(cursor, 1, { count: 20, rows: 5 });
    expect(cursor).toEqual({ selected: 7, top: 3 });
    for (let step = 0; step < 6; step += 1)
      cursor = moveCursor(cursor, -1, { count: 20, rows: 5 });
    expect(cursor).toEqual({ selected: 1, top: 1 });
  });

  it('pages by one window minus one row and clamps at the ends', () => {
    const paged = pageCursor(start, 'down', { count: 30, rows: 10 });
    expect(paged.selected).toBe(9);
    expect(pageCursor(paged, 'up', { count: 30, rows: 10 }).selected).toBe(0);
    expect(
      pageCursor({ selected: 28, top: 20 }, 'down', { count: 30, rows: 10 })
        .selected,
    ).toBe(29);
  });

  it('refits the window after a resize or a shorter list', () => {
    expect(
      refitCursor({ selected: 15, top: 10 }, { count: 20, rows: 3 }),
    ).toEqual({
      selected: 15,
      top: 13,
    });
    expect(
      refitCursor({ selected: 9, top: 5 }, { count: 4, rows: 10 }),
    ).toEqual({
      selected: 3,
      top: 0,
    });
  });

  it('exposes the visible range of a cursor', () => {
    expect(
      visibleRange({ selected: 7, top: 3 }, { count: 20, rows: 5 }),
    ).toEqual({
      start: 3,
      end: 8,
    });
    expect(visibleRange(start, { count: 2, rows: 5 })).toEqual({
      start: 0,
      end: 2,
    });
  });

  it('follows the tail or a highlighted row without a stored cursor', () => {
    expect(followRange(null, { count: 20, rows: 5 })).toEqual({
      start: 15,
      end: 20,
    });
    expect(followRange(2, { count: 20, rows: 6 })).toEqual({
      start: 0,
      end: 6,
    });
    expect(followRange(10, { count: 20, rows: 6 })).toEqual({
      start: 8,
      end: 14,
    });
    expect(followRange(19, { count: 20, rows: 6 })).toEqual({
      start: 14,
      end: 20,
    });
  });
});
