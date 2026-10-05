import { formatOffset } from '../../../shared/domain/format-offset.ts';
import type { ReplayScreen } from '../../domain/app-state.ts';
import type { ReplayStepView, ReplayView } from '../../domain/app-views.ts';
import { followRange } from '../../domain/list-window.ts';
import type { Style } from '../ansi.ts';
import { formatDrift } from '../format.ts';
import { sanitize, spread } from '../layout.ts';
import type { RenderContext, ScreenView } from '../screen-view.ts';
import { rule } from '../screen-view.ts';
import { timelineRow, type RowDecoration } from '../timeline-list.ts';

const HEADER_ROWS = 2;
/** Replay timing is considered good up to this much drift. */
const DRIFT_TOLERANCE_MS = 100;

const STATUS_LABELS: Readonly<Record<ReplayView['status'], string>> = {
  running: '▶ Running',
  succeeded: '✓ Finished',
  failed: '✖ Failed',
  cancelled: '■ Cancelled',
};

function driftText(driftMs: number, style: Style): string {
  const text = formatDrift(driftMs);
  return Math.abs(driftMs) > DRIFT_TOLERANCE_MS
    ? style.warning(text)
    : style.muted(text);
}

function decorate(
  step: ReplayStepView | undefined,
  style: Style,
): RowDecoration {
  const base = { isHighlighted: false, suffix: '' };
  if (step?.status === 'done') {
    const suffix = step.driftMs === null ? '' : driftText(step.driftMs, style);
    return { ...base, symbol: '✓', tone: 'done', suffix };
  }
  if (step?.status === 'running') {
    return { ...base, symbol: '▶', tone: 'running', isHighlighted: true };
  }
  return { ...base, symbol: '·', tone: 'pending' };
}

function focusIndex(steps: readonly ReplayStepView[]): number {
  const running = steps.find((step) => step.status === 'running');
  if (running !== undefined) return running.index;
  const done = steps.filter((step) => step.status === 'done');
  return done.at(-1)?.index ?? 0;
}

function progress(screen: ReplayScreen): string {
  const { steps, status } = screen.view;
  const reached = steps.filter((step) => step.status !== 'pending').length;
  const label = `step ${String(reached)}/${String(screen.events.length)}`;
  return status === 'running' ? label : label.replace('step ', 'steps ');
}

function header(screen: ReplayScreen, context: RenderContext): string[] {
  const { style, width, nowMs } = context;
  const { view } = screen;
  const elapsed =
    view.status === 'running'
      ? `${formatOffset(nowMs - screen.startedAtMs)}  `
      : '';
  const status = style.bold(STATUS_LABELS[view.status]);
  const second =
    view.errorMessage === null
      ? rule(context)
      : `${style.danger('✖')} ${style.danger(sanitize(view.errorMessage))}`;
  return [spread(status, `${elapsed}${progress(screen)}`, width), second];
}

export function renderReplayScreen(
  screen: ReplayScreen,
  context: RenderContext,
): ScreenView {
  const { events, view } = screen;
  const rows = Math.max(1, context.height - HEADER_ROWS);
  const range = followRange(focusIndex(view.steps), {
    count: events.length,
    rows,
  });
  const lines = events.slice(range.start, range.end).map((_, offset) => {
    const index = range.start + offset;
    const step = view.steps.find((candidate) => candidate.index === index);
    return timelineRow(events, index, {
      width: context.width,
      style: context.style,
      decoration: decorate(step, context.style),
    });
  });
  return {
    title: `Replay · ${sanitize(screen.name)}`,
    body: [...header(screen, context), ...lines],
    hints:
      view.status === 'running'
        ? [{ key: 'c', label: 'cancel' }]
        : [{ key: 'esc', label: 'back' }],
  };
}
