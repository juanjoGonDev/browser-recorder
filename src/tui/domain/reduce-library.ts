import type {
  AppState,
  LibraryMode,
  LibraryScreen,
  TimelineScreen,
} from './app-state.ts';
import type { LibraryEntryView } from './app-views.ts';
import type { Recording } from '../../shared/domain/recording.ts';
import { moveCursor, pageCursor, refitCursor } from './list-window.ts';
import { updateScreen } from './screen-update.ts';
import { emptyField } from './text-input.ts';

export function onLibrary(
  state: AppState,
  update: (screen: LibraryScreen) => LibraryScreen,
): AppState {
  return updateScreen(state, 'library', update);
}

function setMode(state: AppState, mode: LibraryMode): AppState {
  return onLibrary(state, (screen) => ({ ...screen, mode }));
}

export function libraryLoaded(
  state: AppState,
  entries: readonly LibraryEntryView[],
): AppState {
  return onLibrary(state, (screen) => ({
    ...screen,
    entries,
    cursor: refitCursor(screen.cursor, {
      count: entries.length,
      rows: state.listRows,
    }),
  }));
}

export function libraryError(
  state: AppState,
  message: string | null,
): AppState {
  return onLibrary(state, (screen) => ({ ...screen, error: message }));
}

export function beginRename(state: AppState): AppState {
  return onLibrary(state, (screen) => {
    const selected = screen.entries[screen.cursor.selected];
    if (selected?.kind !== 'valid') return screen;
    return {
      ...screen,
      error: null,
      mode: { kind: 'rename', field: emptyField(selected.name) },
    };
  });
}

export function beginDelete(state: AppState): AppState {
  return onLibrary(state, (screen) =>
    screen.entries.length === 0
      ? screen
      : { ...screen, error: null, mode: { kind: 'confirm-delete' } },
  );
}

export function cancelMode(state: AppState): AppState {
  return setMode(state, { kind: 'browse' });
}

export function timelineOpened(
  state: AppState,
  recording: Recording,
): AppState {
  return {
    ...state,
    screen: { kind: 'timeline', recording, cursor: { selected: 0, top: 0 } },
  };
}

function onTimeline(
  state: AppState,
  update: (screen: TimelineScreen) => TimelineScreen,
): AppState {
  return updateScreen(state, 'timeline', update);
}

export function moveListSelection(state: AppState, delta: number): AppState {
  const rows = state.listRows;
  const library = onLibrary(state, (screen) => ({
    ...screen,
    cursor: moveCursor(screen.cursor, delta, {
      count: screen.entries.length,
      rows,
    }),
  }));
  return onTimeline(library, (screen) => ({
    ...screen,
    cursor: moveCursor(screen.cursor, delta, {
      count: screen.recording.events.length,
      rows,
    }),
  }));
}

export function pageListSelection(
  state: AppState,
  direction: 'up' | 'down',
): AppState {
  const rows = state.listRows;
  const library = onLibrary(state, (screen) => ({
    ...screen,
    cursor: pageCursor(screen.cursor, direction, {
      count: screen.entries.length,
      rows,
    }),
  }));
  return onTimeline(library, (screen) => ({
    ...screen,
    cursor: pageCursor(screen.cursor, direction, {
      count: screen.recording.events.length,
      rows,
    }),
  }));
}

/** Re-fits both list cursors to a new window height. */
export function resizeLists(state: AppState, listRows: number): AppState {
  const resized = { ...state, listRows };
  const library = onLibrary(resized, (screen) => ({
    ...screen,
    cursor: refitCursor(screen.cursor, {
      count: screen.entries.length,
      rows: listRows,
    }),
  }));
  return onTimeline(library, (screen) => ({
    ...screen,
    cursor: refitCursor(screen.cursor, {
      count: screen.recording.events.length,
      rows: listRows,
    }),
  }));
}
