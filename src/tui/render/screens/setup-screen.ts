import type { SetupScreen } from '../../domain/app-state.ts';
import { spinnerFrame } from '../format.ts';
import type { RenderContext, ScreenView } from '../screen-view.ts';

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

function failedBody(screen: SetupScreen, context: RenderContext): string[] {
  const { style } = context;
  return [
    '',
    `  ${style.danger('✖')} ${style.bold('Chromium could not be installed.')}`,
    ...exitCodeLine(screen, context),
    '',
    '  Install it yourself, then retry:',
    `    ${style.accent(screen.manualCommand ?? '')}`,
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

export function renderSetupScreen(
  screen: SetupScreen,
  context: RenderContext,
): ScreenView {
  const isFailed = screen.phase === 'failed';
  return {
    title: 'Setting up',
    body: isFailed ? failedBody(screen, context) : busyBody(screen, context),
    hints: isFailed
      ? [{ key: 'enter', label: 'retry' }, QUIT_HINT]
      : [QUIT_HINT],
  };
}
