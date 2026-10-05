import type { ListCursor } from './app-state.ts';

/** How many rows the list has and how many of them fit on screen. */
export interface ListSize {
  readonly count: number;
  readonly rows: number;
}

export interface RowRange {
  readonly start: number;
  readonly end: number;
}

/** Rows kept above the highlighted one when following it. */
const FOLLOW_LEAD_DIVISOR = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lastIndex(count: number): number {
  return Math.max(0, count - 1);
}

/** Smallest scroll that keeps `selected` inside a window of `rows` rows. */
function revealSelected(selected: number, top: number, size: ListSize): number {
  const { count, rows } = size;
  const height = Math.max(1, rows);
  const maxTop = Math.max(0, count - height);
  if (selected < top) return clamp(selected, 0, maxTop);
  if (selected >= top + height) return clamp(selected - height + 1, 0, maxTop);
  return clamp(top, 0, maxTop);
}

/** Re-fits a cursor after the list or the window size changed. */
export function refitCursor(cursor: ListCursor, size: ListSize): ListCursor {
  const selected = clamp(cursor.selected, 0, lastIndex(size.count));
  return { selected, top: revealSelected(selected, cursor.top, size) };
}

/** Moves the selection by `delta`; it never wraps out of bounds. */
export function moveCursor(
  cursor: ListCursor,
  delta: number,
  size: ListSize,
): ListCursor {
  return refitCursor(
    { selected: cursor.selected + delta, top: cursor.top },
    size,
  );
}

/** Moves by one window, keeping one row of context. */
export function pageCursor(
  cursor: ListCursor,
  direction: 'up' | 'down',
  size: ListSize,
): ListCursor {
  const step = Math.max(1, size.rows - 1);
  return moveCursor(cursor, direction === 'down' ? step : -step, size);
}

export function visibleRange(cursor: ListCursor, size: ListSize): RowRange {
  const fitted = refitCursor(cursor, size);
  return {
    start: fitted.top,
    end: Math.min(size.count, fitted.top + size.rows),
  };
}

/**
 * A window for lists without a stored cursor: the tail when nothing is
 * highlighted, otherwise the highlighted row with a little context above it.
 */
export function followRange(
  highlighted: number | null,
  size: ListSize,
): RowRange {
  const { count, rows } = size;
  const maxStart = Math.max(0, count - rows);
  const wanted =
    highlighted === null
      ? maxStart
      : highlighted - Math.floor(rows / FOLLOW_LEAD_DIVISOR);
  const start = clamp(wanted, 0, maxStart);
  return { start, end: Math.min(count, start + rows) };
}
