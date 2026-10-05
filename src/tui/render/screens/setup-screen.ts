import type { SetupScreen } from '../../domain/app-state.ts';
import { spinnerFrame } from '../format.ts';
import { sanitize } from '../layout.ts';
import type { RenderContext, ScreenView } from '../screen-view.ts';
import type { KeyHint } from '../status-bar.ts';

const QUIT_HINT = { key: 'q', label: 'quit' } as const;
const HEADER_ROWS = 3;

function tail(lines: readonly string[], context: RenderContext): string[] {
  const rows = Math.max(0, context.height - HEADER_ROWS);
  return lines.slice(-rows).map((line) => `  ${context.style.muted(line)}`);
}

function exitCodeLine(screen: SetupScreen, context: RenderContext): string[] {
  return screen.exitCode === null
    ? []
    : [
        `  ${context.style.muted(`The installer failed with exit code ${String(screen.exitCode)}.`)}`,
      ];
}

function afterFailure(screen: SetupScreen, context: RenderContext): string[] {
  const { style } = context;
  if (screen.browsers.length === 0) {
    return [
      `  ${style.muted('Meanwhile the library stays open; recording and replay are disabled.')}`,
    ];
  }
  return [
    `  ${style.bold(`Detected: ${sanitize(screen.browsers.join(', '))}`)}`,
    `  ${style.muted('You can still record with them (press m); the library stays open too.')}`,
  ];
}

function failedBody(screen: SetupScreen, context: RenderContext): string[] {
  const { style } = context;
  return [
    '',
    `  ${style.danger('✖')} ${style.bold('Chromium could not be installed.')}`,
    ...exitCodeLine(screen, context),
    '',
    '  Install it yourself, then retry:',
    `    ${style.accent(screen.manualCommand ?? '')}`,
    '',
    ...afterFailure(screen, context),
  ];
}

function busyBody(screen: SetupScreen, context: RenderContext): string[] {
  const { style, nowMs } = context;
  const spinner = style.accent(spinnerFrame(nowMs));
  const text =
    screen.phase === 'installing'
      ? 'Installing Chromium (first run only)…'
      : 'Checking for Chromium…';
  return ['', `  ${spinner} ${text}`, '', ...tail(screen.lines, context)];
}

function failedHints(screen: SetupScreen): KeyHint[] {
  return [
    { key: 'enter', label: 'retry' },
    ...(screen.browsers.length > 0 ? [{ key: 'm', label: 'menu' }] : []),
    { key: 'l', label: 'library' },
    QUIT_HINT,
  ];
}

export function renderSetupScreen(
  screen: SetupScreen,
  context: RenderContext,
): ScreenView {
  const isFailed = screen.phase === 'failed';
  return {
    title: 'Setting up',
    body: isFailed ? failedBody(screen, context) : busyBody(screen, context),
    hints: isFailed ? failedHints(screen) : [QUIT_HINT],
  };
}
