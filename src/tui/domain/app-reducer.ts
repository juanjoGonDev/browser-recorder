import type { AppAction } from './app-action.ts';
import type {
  AppState,
  LibraryScreen,
  NewRecordingScreen,
  RecordingScreen,
  Screen,
} from './app-state.ts';
import { MAIN_MENU_ITEMS } from './main-menu-items.ts';
import {
  beginDelete,
  beginRename,
  cancelMode,
  libraryError,
  libraryLoaded,
  moveListSelection,
  onLibrary,
  pageListSelection,
  resizeLists,
  timelineOpened,
} from './reduce-library.ts';
import {
  blankForm,
  browsersFailed,
  browsersLoaded,
  cycleOption,
  onForm,
} from './reduce-form.ts';
import {
  onRecording,
  recordingStarted,
  recordingUpdated,
  setConfirmingDiscard,
  setStopping,
} from './reduce-recording.ts';
import {
  setupFailed,
  setupInstalling,
  setupOutput,
  setupReady,
} from './reduce-setup.ts';
import { updateScreen } from './screen-update.ts';
import { applyEdit } from './text-input.ts';
import { listRowsFor } from './viewport.ts';
import type { MenuTarget, TextEdit } from './intent.ts';

const INITIAL_TERMINAL_ROWS = 24;
const LAST_MENU_INDEX = MAIN_MENU_ITEMS.length - 1;

export function initialState(): AppState {
  return {
    screen: {
      kind: 'setup',
      phase: 'checking',
      lines: [],
      manualCommand: null,
      exitCode: null,
    },
    nowMs: 0,
    listRows: listRowsFor(INITIAL_TERMINAL_ROWS),
    linuxHint: null,
    isBrowserAvailable: true,
    isQuitting: false,
  };
}

function screenFor(target: MenuTarget): Screen {
  switch (target) {
    case 'main-menu':
      return { kind: 'main-menu', selected: 0 };
    case 'new-recording':
      return blankForm();
    case 'library':
      return {
        kind: 'library',
        entries: [],
        cursor: { selected: 0, top: 0 },
        mode: { kind: 'browse' },
        error: null,
      };
  }
}

function moveSelection(state: AppState, delta: number): AppState {
  const menu = updateScreen(state, 'main-menu', (screen) => ({
    ...screen,
    selected: Math.min(Math.max(screen.selected + delta, 0), LAST_MENU_INDEX),
  }));
  return moveListSelection(menu, delta);
}

const FOCUS_ORDER = ['name', 'url', 'browser', 'profile'] as const;

function nextFocus(screen: NewRecordingScreen): NewRecordingScreen {
  const at = FOCUS_ORDER.indexOf(screen.focus);
  return {
    ...screen,
    focus: FOCUS_ORDER[(at + 1) % FOCUS_ORDER.length] ?? 'name',
  };
}

function editLibrary(screen: LibraryScreen, edit: TextEdit): LibraryScreen {
  if (screen.mode.kind !== 'rename') return screen;
  return {
    ...screen,
    error: null,
    mode: { kind: 'rename', field: applyEdit(screen.mode.field, edit) },
  };
}

function editForm(
  screen: NewRecordingScreen,
  edit: TextEdit,
): NewRecordingScreen {
  if (screen.focus !== 'name' && screen.focus !== 'url') return screen;
  const key = screen.focus === 'name' ? 'name' : 'startUrl';
  return { ...screen, error: null, [key]: applyEdit(screen[key], edit) };
}

function editPrompt(screen: RecordingScreen, edit: TextEdit): RecordingScreen {
  if (screen.pendingDialog?.dialogType !== 'prompt') return screen;
  return { ...screen, promptText: applyEdit(screen.promptText, edit) };
}

function editText(state: AppState, edit: TextEdit): AppState {
  const form = onForm(state, (screen) => editForm(screen, edit));
  const library = onLibrary(form, (screen) => editLibrary(screen, edit));
  return onRecording(library, (screen) => editPrompt(screen, edit));
}

type Handlers = {
  readonly [K in AppAction['type']]: (
    state: AppState,
    action: Extract<AppAction, { type: K }>,
  ) => AppState;
};

const handlers: Handlers = {
  tick: (state, action) => ({ ...state, nowMs: action.nowMs }),
  resize: (state, action) => resizeLists(state, action.listRows),
  'setup-output': (state, action) => setupOutput(state, action.line),
  'setup-installing': setupInstalling,
  'setup-ready': (state, action) => setupReady(state, action.linuxHint),
  'setup-failed': (state, action) =>
    setupFailed(state, action.manualCommand, action.exitCode),
  navigate: (state, action) => ({ ...state, screen: screenFor(action.target) }),
  'move-selection': (state, action) => moveSelection(state, action.delta),
  'page-selection': (state, action) =>
    pageListSelection(state, action.direction),
  'switch-field': (state) => onForm(state, nextFocus),
  'cycle-option': (state, action) => cycleOption(state, action.delta),
  'browsers-loaded': (state, action) => browsersLoaded(state, action.browsers),
  'browsers-failed': (state, action) => browsersFailed(state, action.message),
  'edit-text': (state, action) => editText(state, action.edit),
  'form-error': (state, action) =>
    onForm(state, (screen) => ({ ...screen, error: action.message })),
  'recording-started': (state, action) => recordingStarted(state, action.name),
  'recording-updated': (state, action) =>
    recordingUpdated(state, action.update),
  'recording-stopping': setStopping,
  'request-discard': (state) => setConfirmingDiscard(state, true),
  'cancel-discard': (state) => setConfirmingDiscard(state, false),
  'library-loaded': (state, action) => libraryLoaded(state, action.entries),
  'begin-rename': beginRename,
  'begin-delete': beginDelete,
  'cancel-mode': cancelMode,
  'library-error': (state, action) => libraryError(state, action.message),
  'timeline-opened': (state, action) => timelineOpened(state, action.recording),
  'replay-started': (state, action) => ({
    ...state,
    screen: {
      kind: 'replay',
      name: action.recording.name,
      events: action.recording.events,
      view: action.view,
      startedAtMs: state.nowMs,
    },
  }),
  'replay-updated': (state, action) =>
    updateScreen(state, 'replay', (screen) => ({
      ...screen,
      view: action.view,
    })),
  quit: (state) => ({ ...state, isQuitting: true }),
};

/** The whole app state machine: pure, so the controller is the only IO. */
export function appReducer(state: AppState, action: AppAction): AppState {
  const handler = handlers[action.type] as (
    current: AppState,
    next: AppAction,
  ) => AppState;
  return handler(state, action);
}
