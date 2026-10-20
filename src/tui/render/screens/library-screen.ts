import type { LibraryMode, LibraryScreen } from '../../domain/app-state.ts';
import type { LibraryEntryView } from '../../domain/app-views.ts';
import { BROWSER_REQUIRED_REASON } from '../../domain/browser-required.ts';
import { visibleRange } from '../../domain/list-window.ts';
import type { Style } from '../ansi.ts';
import { describeBrowser } from '../browser-summary.ts';
import { renderField } from '../field-view.ts';
import { formatCreated, formatDuration, formatTiming } from '../format.ts';
import { cellWidth, padEnd, spread } from '../layout.ts';
import { sanitize } from '../../../shared/domain/terminal-text.ts';
import type { RenderContext, ScreenView } from '../screen-view.ts';
import { listRowsOf } from '../screen-view.ts';
import type { KeyHint } from '../status-bar.ts';
import {
  CHANGE_BROWSER_HINTS,
  changeBrowserLines,
  changeBrowserPrompt,
} from './library-browser-change.ts';
import { wrappedErrorLines } from './wrapped-error.ts';

const MARKER_WIDTH = 2;
const CREATED_WIDTH = 16;
const DURATION_WIDTH = 8;
const STEPS_WIDTH = 5;
const BROWSER_WIDTH = 16;
/** The browser column goes before the date column does. */
const MIN_WIDTH_FOR_BROWSER = 72;
/** Below this the date column goes first, so names keep room. */
const MIN_WIDTH_FOR_CREATED = 60;
const RENAME_LABEL = 'Rename: ';

interface Columns {
  readonly name: number;
  readonly hasCreated: boolean;
  readonly hasBrowser: boolean;
}

function planColumns(width: number): Columns {
  const hasCreated = width >= MIN_WIDTH_FOR_CREATED;
  const hasBrowser = width >= MIN_WIDTH_FOR_BROWSER;
  const fixed =
    MARKER_WIDTH +
    DURATION_WIDTH +
    STEPS_WIDTH +
    2 +
    (hasCreated ? CREATED_WIDTH + 1 : 0) +
    (hasBrowser ? BROWSER_WIDTH + 1 : 0);
  return { name: Math.max(1, width - fixed), hasCreated, hasBrowser };
}

interface RowText {
  readonly name: string;
  readonly created: string;
  readonly browser: string;
  readonly duration: string;
  readonly steps: string;
}

function cells(text: RowText, plan: Columns): string {
  return [
    padEnd(text.name, plan.name),
    ...(plan.hasCreated ? [padEnd(text.created, CREATED_WIDTH)] : []),
    ...(plan.hasBrowser ? [padEnd(text.browser, BROWSER_WIDTH)] : []),
    text.duration.padStart(DURATION_WIDTH),
    text.steps.padStart(STEPS_WIDTH),
  ].join(' ');
}

function entryRow(
  entry: LibraryEntryView,
  isSelected: boolean,
  context: RenderContext,
): string {
  const { style, width } = context;
  const plan = planColumns(width);
  const marker = isSelected ? '❯ ' : '  ';
  const text =
    entry.kind === 'valid'
      ? cells(
          {
            name: sanitize(entry.name),
            created: formatCreated(entry.createdAt),
            browser:
              entry.browser === undefined
                ? ''
                : sanitize(describeBrowser(entry.browser)),
            duration: formatDuration(entry.durationMs),
            steps: String(entry.stepCount),
          },
          plan,
        )
      : style.danger(
          padEnd(
            `✖ ${entry.slug} — ${sanitize(entry.reason)}`,
            width - MARKER_WIDTH,
          ),
        );
  const line = padEnd(marker + text, width);
  return isSelected ? style.inverse(line) : line;
}

function columnHeader(context: RenderContext): string {
  const plan = planColumns(context.width);
  const text = cells(
    {
      name: 'Name',
      created: 'Created',
      browser: 'Browser',
      duration: 'Duration',
      steps: 'Steps',
    },
    plan,
  );
  return context.style.muted(
    padEnd(`  ${text}`.slice(0, context.width), context.width),
  );
}

function positionText(screen: LibraryScreen, context: RenderContext): string {
  return context.style.muted(
    `${formatTiming(screen.timing)} · ${String(screen.cursor.selected + 1)}/${String(screen.entries.length)}`,
  );
}

/**
 * Errors that do not fit beside the position are wrapped below the status
 * line. While a browser is being picked the status line holds the question,
 * so its errors always go below it.
 */
function longErrorOf(screen: LibraryScreen, context: RenderContext): string[] {
  const { mode } = screen;
  if (mode.kind !== 'browse' && mode.kind !== 'change-browser') return [];
  const room =
    mode.kind === 'change-browser'
      ? 0
      : context.width - cellWidth(positionText(screen, context)) - 1;
  return wrappedErrorLines(screen.error, room, context);
}

function pickerLinesOf(
  screen: LibraryScreen,
  context: RenderContext,
): string[] {
  return screen.mode.kind === 'change-browser'
    ? changeBrowserLines(screen.mode, context)
    : [];
}

function statusLine(
  screen: LibraryScreen,
  context: RenderContext,
  hasLongError: boolean,
): string {
  const prompt = hasLongError ? '' : promptOf(screen.mode, screen, context);
  return spread(prompt, positionText(screen, context), context.width);
}

function selectedName(screen: LibraryScreen): string {
  const entry = screen.entries[screen.cursor.selected];
  if (entry === undefined) return '';
  return sanitize(entry.kind === 'valid' ? entry.name : entry.slug);
}

function promptOf(
  mode: LibraryMode,
  screen: LibraryScreen,
  context: RenderContext,
): string {
  const { style } = context;
  if (mode.kind === 'rename') {
    const field = renderField(
      {
        field: mode.field,
        width: context.width - RENAME_LABEL.length,
        isFocused: true,
        placeholder: '',
      },
      style,
    );
    return `${style.bold(RENAME_LABEL)}${field}`;
  }
  if (mode.kind === 'confirm-delete') {
    return style.warning(style.bold(`Delete "${selectedName(screen)}"? [y/N]`));
  }
  if (mode.kind === 'change-browser') {
    return changeBrowserPrompt(selectedName(screen), context);
  }
  return screen.error === null ? '' : errorText(screen.error, style);
}

function errorText(message: string, style: Style): string {
  return `${style.danger('✖')} ${style.danger(sanitize(message))}`;
}

function hintsFor(mode: LibraryMode, isBrowserAvailable: boolean): KeyHint[] {
  if (mode.kind === 'rename') {
    return [
      { key: 'enter', label: 'save' },
      { key: 'esc', label: 'cancel' },
    ];
  }
  if (mode.kind === 'confirm-delete') {
    return [
      { key: 'y', label: 'delete' },
      { key: 'n', label: 'keep' },
    ];
  }
  if (mode.kind === 'change-browser') return [...CHANGE_BROWSER_HINTS];
  return [
    { key: '↑↓', label: 'move' },
    ...(isBrowserAvailable
      ? [
          { key: 'enter', label: 'replay' },
          { key: 'h', label: 'mode' },
        ]
      : []),
    { key: 't', label: 'steps' },
    { key: 'r', label: 'rename' },
    { key: 'b', label: 'browser' },
    { key: 'd', label: 'delete' },
    ...(isBrowserAvailable ? [{ key: 'n', label: 'new' }] : []),
    { key: 'esc', label: 'back' },
  ];
}

function emptyBody(screen: LibraryScreen, context: RenderContext): string[] {
  const { style } = context;
  const create = context.isBrowserAvailable
    ? [`  Press ${style.accent('n')} to create your first recording.`]
    : [`  ${style.muted(BROWSER_REQUIRED_REASON)}`];
  const lines = ['', `  ${style.bold('No recordings yet.')}`, ...create];
  return screen.error === null
    ? lines
    : [...lines, '', `  ${errorText(screen.error, style)}`];
}

export function renderLibraryScreen(
  screen: LibraryScreen,
  context: RenderContext,
): ScreenView {
  const hints = hintsFor(screen.mode, context.isBrowserAvailable);
  if (screen.entries.length === 0) {
    return { title: 'Library', body: emptyBody(screen, context), hints };
  }
  const errorLines = longErrorOf(screen, context);
  const block = [...errorLines, ...pickerLinesOf(screen, context)];
  const isErrorBelow = screen.mode.kind === 'browse' && errorLines.length > 0;
  const range = visibleRange(screen.cursor, {
    count: screen.entries.length,
    rows: Math.max(1, listRowsOf(context) - block.length),
  });
  const rows = screen.entries
    .slice(range.start, range.end)
    .map((entry, offset) =>
      entryRow(entry, range.start + offset === screen.cursor.selected, context),
    );
  return {
    title: 'Library',
    body: [
      columnHeader(context),
      statusLine(screen, context, isErrorBelow),
      ...block,
      ...rows,
    ],
    hints,
  };
}
