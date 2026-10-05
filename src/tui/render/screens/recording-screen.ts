import { formatOffset } from '../../../shared/domain/format-offset.ts';
import type { RecordingScreen } from '../../domain/app-state.ts';
import { followRange } from '../../domain/list-window.ts';
import { renderField } from '../field-view.ts';
import { pluralize } from '../format.ts';
import { sanitize, spread } from '../layout.ts';
import type { RenderContext, ScreenView } from '../screen-view.ts';
import { rule } from '../screen-view.ts';
import type { KeyHint } from '../status-bar.ts';
import { NO_DECORATION, timelineRow } from '../timeline-list.ts';

const HEADER_ROWS = 2;
const ANSWER_LABEL = 'Answer: ';

function header(screen: RecordingScreen, context: RenderContext): string[] {
  const { style, width, nowMs } = context;
  const count = pluralize(screen.events.length, 'event');
  const elapsed = formatOffset(nowMs - screen.startedAtMs);
  const left = `${style.danger('●')} ${style.bold('REC')}  ${sanitize(screen.name)}`;
  const masked = screen.events.filter(
    (event) => event.kind === 'fill' && event.isSensitive,
  ).length;
  const note =
    masked === 0
      ? rule(context)
      : style.warning(`${pluralize(masked, 'sensitive value')} masked`);
  return [spread(left, `${elapsed}  ${count}`, width), note];
}

function banner(screen: RecordingScreen, context: RenderContext): string[] {
  const { style, width } = context;
  const dialog = screen.pendingDialog;
  if (screen.isStopping) return [style.muted('Saving the recording…')];
  if (screen.isConfirmingDiscard) {
    return [style.warning(style.bold('Discard this recording? [y/N]'))];
  }
  if (dialog === null) return [];
  const title = `${style.warning('!')} ${dialog.dialogType} dialog: "${sanitize(dialog.message)}"`;
  if (dialog.dialogType !== 'prompt') return [title];
  const field = renderField(
    {
      field: screen.promptText,
      width: width - ANSWER_LABEL.length,
      isFocused: true,
      placeholder: '',
    },
    style,
  );
  return [title, `${ANSWER_LABEL}${field}`];
}

function hintsFor(screen: RecordingScreen): KeyHint[] {
  if (screen.isStopping) return [];
  if (screen.isConfirmingDiscard) {
    return [
      { key: 'y', label: 'discard' },
      { key: 'n', label: 'keep recording' },
    ];
  }
  if (screen.pendingDialog?.dialogType === 'prompt') {
    return [
      { key: 'enter', label: 'accept' },
      { key: 'esc', label: 'dismiss' },
    ];
  }
  if (screen.pendingDialog !== null) {
    return [
      { key: 'a', label: 'accept' },
      { key: 'd', label: 'dismiss' },
    ];
  }
  return [
    { key: 's', label: 'stop and save' },
    { key: 'x', label: 'discard' },
  ];
}

function eventRows(
  screen: RecordingScreen,
  context: RenderContext,
  rows: number,
): string[] {
  const { events } = screen;
  if (events.length === 0) {
    return [
      context.style.muted('Waiting for your first action in the browser…'),
    ];
  }
  const range = followRange(null, { count: events.length, rows });
  return events.slice(range.start, range.end).map((_, offset) =>
    timelineRow(events, range.start + offset, {
      width: context.width,
      style: context.style,
      decoration: NO_DECORATION,
    }),
  );
}

export function renderRecordingScreen(
  screen: RecordingScreen,
  context: RenderContext,
): ScreenView {
  const bannerLines = banner(screen, context);
  const rows = Math.max(1, context.height - HEADER_ROWS - bannerLines.length);
  return {
    title: 'Recording',
    body: [
      ...header(screen, context),
      ...eventRows(screen, context, rows),
      ...bannerLines,
    ],
    hints: hintsFor(screen),
  };
}
