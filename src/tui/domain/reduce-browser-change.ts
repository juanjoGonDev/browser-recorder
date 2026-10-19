import { BUNDLED_EPHEMERAL } from '../../shared/domain/browser-choice.ts';
import type {
  AppState,
  ChangeBrowserMode,
  LibraryScreen,
} from './app-state.ts';
import type { BrowserOptionView } from './app-views.ts';
import { cyclePicker, preselectPicker } from './browser-picker.ts';
import { onLibrary } from './reduce-library.ts';

type ModeUpdate = (mode: ChangeBrowserMode) => ChangeBrowserMode;

/** Applies `update` only while the library is changing a browser. */
function onChange(state: AppState, update: ModeUpdate): AppState {
  return onLibrary(state, (screen) =>
    screen.mode.kind === 'change-browser'
      ? { ...screen, mode: update(screen.mode) }
      : screen,
  );
}

function openFor(screen: LibraryScreen): LibraryScreen {
  const entry = screen.entries[screen.cursor.selected];
  if (entry?.kind !== 'valid') return screen;
  return {
    ...screen,
    error: null,
    mode: {
      kind: 'change-browser',
      slug: entry.slug,
      current: entry.browser ?? BUNDLED_EPHEMERAL,
      focus: 'browser',
      browsers: null,
      browserIndex: 0,
      profileIndex: 0,
    },
  };
}

export function beginBrowserChange(state: AppState): AppState {
  return onLibrary(state, openFor);
}

export function changeBrowsersLoaded(
  state: AppState,
  browsers: readonly BrowserOptionView[],
): AppState {
  return onChange(state, (mode) => ({
    ...mode,
    ...preselectPicker(browsers, mode.current),
  }));
}

/** An empty list stops the wait; the error explains why nothing is offered. */
export function changeBrowsersFailed(
  state: AppState,
  message: string,
): AppState {
  const emptied = onChange(state, (mode) => ({ ...mode, browsers: [] }));
  return onLibrary(emptied, (screen) =>
    screen.mode.kind === 'change-browser'
      ? { ...screen, error: message }
      : screen,
  );
}

export function cycleChange(state: AppState, delta: number): AppState {
  const cycled = onChange(state, (mode) =>
    cyclePicker(mode, mode.focus, delta),
  );
  return onLibrary(cycled, (screen) =>
    screen.mode.kind === 'change-browser' ? { ...screen, error: null } : screen,
  );
}

export function switchChangeField(state: AppState): AppState {
  return onChange(state, (mode) => ({
    ...mode,
    focus: mode.focus === 'browser' ? 'profile' : 'browser',
  }));
}
