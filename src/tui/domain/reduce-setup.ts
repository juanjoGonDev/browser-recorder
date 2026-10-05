import type { AppAction } from './app-action.ts';
import type { AppState, SetupScreen } from './app-state.ts';
import { updateScreen } from './screen-update.ts';

/** Installer output is only ever shown as a tail. */
const MAX_SETUP_LINES = 50;

type SetupUpdate = (screen: SetupScreen) => SetupScreen;

function onSetup(state: AppState, update: SetupUpdate): AppState {
  return updateScreen(state, 'setup', update);
}

export function setupInstalling(state: AppState): AppState {
  return onSetup(state, (screen) => ({ ...screen, phase: 'installing' }));
}

export function setupOutput(state: AppState, line: string): AppState {
  return onSetup(state, (screen) => ({
    ...screen,
    lines: [...screen.lines, line].slice(-MAX_SETUP_LINES),
  }));
}

export function setupReady(
  state: AppState,
  linuxHint: string | null,
  browsers: readonly string[],
): AppState {
  return {
    ...state,
    linuxHint,
    isBrowserAvailable: true,
    isBundledMissing: false,
    detectedBrowsers: browsers,
    screen: { kind: 'main-menu', selected: 0 },
  };
}

export function setupFailed(
  state: AppState,
  failure: Extract<AppAction, { type: 'setup-failed' }>,
): AppState {
  const { manualCommand, exitCode, browsers } = failure;
  const failed = onSetup(state, (screen) => ({
    ...screen,
    phase: 'failed',
    manualCommand,
    exitCode,
    browsers,
  }));
  return {
    ...failed,
    // Another detected browser can still record, so only the bundled one is lost.
    isBrowserAvailable: browsers.length > 0,
    isBundledMissing: true,
    detectedBrowsers: browsers,
  };
}
