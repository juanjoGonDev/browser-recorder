import type { AppState, Screen } from '../domain/app-state.ts';
import { MIN_COLUMNS, MIN_ROWS } from '../domain/viewport.ts';
import { createStyle } from './ansi.ts';
import { box, center, padEnd } from './layout.ts';
import { renderLibraryScreen } from './screens/library-screen.ts';
import { renderMainMenuScreen } from './screens/main-menu-screen.ts';
import { renderNewRecordingScreen } from './screens/new-recording-screen.ts';
import { renderRecordingScreen } from './screens/recording-screen.ts';
import { renderReplayScreen } from './screens/replay-screen.ts';
import { renderSetupScreen } from './screens/setup-screen.ts';
import { renderTimelineScreen } from './screens/timeline-screen.ts';
import type { RenderContext, ScreenView } from './screen-view.ts';
import { renderStatusBar } from './status-bar.ts';

/** Structurally the terminal port's size; render never imports a port. */
export interface FrameSize {
  readonly columns: number;
  readonly rows: number;
}

/** Border (2 columns, 2 rows) and the status bar row. */
const BORDER_COLUMNS = 4;
const CHROME_ROWS = 3;

function renderScreen(screen: Screen, context: RenderContext): ScreenView {
  switch (screen.kind) {
    case 'setup':
      return renderSetupScreen(screen, context);
    case 'main-menu':
      return renderMainMenuScreen(screen, context);
    case 'new-recording':
      return renderNewRecordingScreen(screen, context);
    case 'recording':
      return renderRecordingScreen(screen, context);
    case 'library':
      return renderLibraryScreen(screen, context);
    case 'timeline':
      return renderTimelineScreen(screen, context);
    case 'replay':
      return renderReplayScreen(screen, context);
  }
}

function tooSmall(size: FrameSize): string[] {
  const message = `Terminal too small: need ${String(MIN_COLUMNS)}x${String(MIN_ROWS)}`;
  const middle = Math.floor(size.rows / 2);
  return Array.from({ length: size.rows }, (_, row) =>
    row === middle ? center(message, size.columns) : ' '.repeat(size.columns),
  );
}

/**
 * The whole frame as `size.rows` lines of exactly `size.columns` cells: a
 * pure function of state and size, so it is testable without a TTY.
 */
export function renderApp(
  state: AppState,
  size: FrameSize,
  hasColor: boolean,
): string[] {
  if (size.columns < MIN_COLUMNS || size.rows < MIN_ROWS) return tooSmall(size);
  const style = createStyle(hasColor);
  const context: RenderContext = {
    width: size.columns - BORDER_COLUMNS,
    height: size.rows - CHROME_ROWS,
    style,
    nowMs: state.nowMs,
    linuxHint: state.linuxHint,
  };
  const view = renderScreen(state.screen, context);
  const framed = box({
    title: view.title,
    body: view.body,
    width: size.columns,
    height: size.rows - 1,
  });
  return [
    ...framed,
    padEnd(renderStatusBar(view.hints, size.columns, style), size.columns),
  ];
}
