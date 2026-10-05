import type { RecordingEvent } from '../../shared/domain/recording-event.ts';
import { formatOffset } from '../../shared/domain/format-offset.ts';
import type { Style } from './ansi.ts';
import { describeEvent } from './describe-event.ts';
import { gapBar } from './format.ts';
import { cellWidth, clip, padEnd } from './layout.ts';

export type RowTone = 'normal' | 'done' | 'running' | 'pending';

export interface RowDecoration {
  /** One cell at the start of the row. */
  readonly symbol: string;
  readonly tone: RowTone;
  readonly isHighlighted: boolean;
  /** Right-aligned text such as a replay drift. */
  readonly suffix: string;
}

export interface RowView {
  readonly width: number;
  readonly style: Style;
  readonly decoration: RowDecoration;
}

export const NO_DECORATION: RowDecoration = {
  symbol: ' ',
  tone: 'normal',
  isHighlighted: false,
  suffix: '',
};

const OFFSET_WIDTH = 10;
const GAP_WIDTH = 6;
const LABEL_WIDTH = 13;
const LONG_PAUSE_MS = 2000;
/** symbol, offset, gap and label columns plus their four separators. */
const PREFIX_WIDTH = 1 + OFFSET_WIDTH + GAP_WIDTH + LABEL_WIDTH + 4;

function gapBefore(events: readonly RecordingEvent[], index: number): number {
  const previous = events[index - 1];
  const current = events[index];
  if (previous === undefined || current === undefined) return 0;
  return current.offsetMs - previous.offsetMs;
}

function symbolPaint(view: RowView): string {
  const { style, decoration } = view;
  switch (decoration.tone) {
    case 'done':
      return style.success(decoration.symbol);
    case 'running':
      return style.bold(style.accent(decoration.symbol));
    case 'pending':
      return style.muted(decoration.symbol);
    case 'normal':
      return style.accent(decoration.symbol);
  }
}

function columns(
  events: readonly RecordingEvent[],
  index: number,
  style: Style,
): string[] {
  const event = events[index];
  if (event === undefined) return [];
  const gap = gapBefore(events, index);
  const bar = gap >= LONG_PAUSE_MS ? style.warning : style.muted;
  return [
    style.muted(padEnd(`+${formatOffset(event.offsetMs)}`, OFFSET_WIDTH)),
    bar(padEnd(gapBar(gap), GAP_WIDTH)),
    style.accent(padEnd(describeEvent(event).label, LABEL_WIDTH)),
  ];
}

function detailOf(events: readonly RecordingEvent[], index: number): string {
  const event = events[index];
  return event === undefined ? '' : describeEvent(event).detail;
}

/**
 * One timeline line of exactly `view.width` cells: marker, offset, pause bar,
 * kind, detail and an optional right-aligned suffix.
 */
export function timelineRow(
  events: readonly RecordingEvent[],
  index: number,
  view: RowView,
): string {
  const { style, decoration, width } = view;
  const suffixRoom =
    decoration.suffix === '' ? 0 : cellWidth(decoration.suffix) + 1;
  const detailWidth = Math.max(0, width - PREFIX_WIDTH - suffixRoom);
  const isPending = decoration.tone === 'pending';
  const detail = padEnd(detailOf(events, index), detailWidth);
  const parts = [
    symbolPaint(view),
    ...columns(events, index, style),
    isPending ? style.muted(detail) : detail,
  ];
  const suffix = decoration.suffix === '' ? '' : ` ${decoration.suffix}`;
  const line = clip(parts.join(' ') + suffix, width);
  const padded = padEnd(line, width);
  return decoration.isHighlighted ? style.inverse(padded) : padded;
}
