import type { TimelineScreen } from '../../domain/app-state.ts';
import { visibleRange } from '../../domain/list-window.ts';
import { describeBrowser } from '../browser-summary.ts';
import { formatDuration, pluralize } from '../format.ts';
import { sanitize, spread } from '../layout.ts';
import type { RenderContext, ScreenView } from '../screen-view.ts';
import { listRowsOf, rule } from '../screen-view.ts';
import { timelineRow, type RowDecoration } from '../timeline-list.ts';

const SELECTED: RowDecoration = {
  symbol: '❯',
  tone: 'normal',
  isHighlighted: true,
  suffix: '',
};
const UNSELECTED: RowDecoration = {
  ...SELECTED,
  symbol: ' ',
  isHighlighted: false,
};

function summaryLine(screen: TimelineScreen, context: RenderContext): string {
  const { recording } = screen;
  const count = pluralize(recording.events.length, 'event');
  const left = `${count} · ${formatDuration(recording.durationMs)}`;
  const url = sanitize(recording.startUrl ?? 'blank page');
  const browser = describeBrowser(recording.browser);
  return spread(
    left,
    context.style.muted(`${browser} · ${url}`),
    context.width,
  );
}

function eventRows(screen: TimelineScreen, context: RenderContext): string[] {
  const { events } = screen.recording;
  if (events.length === 0) {
    return [context.style.muted('No events were recorded.')];
  }
  const range = visibleRange(screen.cursor, {
    count: events.length,
    rows: listRowsOf(context),
  });
  return events.slice(range.start, range.end).map((_, offset) => {
    const index = range.start + offset;
    return timelineRow(events, index, {
      width: context.width,
      style: context.style,
      decoration: index === screen.cursor.selected ? SELECTED : UNSELECTED,
    });
  });
}

export function renderTimelineScreen(
  screen: TimelineScreen,
  context: RenderContext,
): ScreenView {
  return {
    title: `Timeline · ${sanitize(screen.recording.name)}`,
    body: [
      summaryLine(screen, context),
      rule(context),
      ...eventRows(screen, context),
    ],
    hints: [
      { key: '↑↓', label: 'scroll' },
      { key: 'pgup/pgdn', label: 'page' },
      { key: 'esc', label: 'back' },
    ],
  };
}
