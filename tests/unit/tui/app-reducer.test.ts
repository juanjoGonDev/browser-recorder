import { describe, expect, it } from 'vitest';

import type { Recording } from '../../../src/shared/domain/recording.ts';
import type { RecordingEvent } from '../../../src/shared/domain/recording-event.ts';
import type { AppAction } from '../../../src/tui/domain/app-action.ts';
import type {
  AppState,
  LibraryScreen,
  NewRecordingScreen,
  RecordingScreen,
  ReplayScreen,
  Screen,
  SetupScreen,
  TimelineScreen,
} from '../../../src/tui/domain/app-state.ts';
import type {
  LibraryEntryView,
  ReplayView,
} from '../../../src/tui/domain/app-views.ts';
import {
  appReducer,
  initialState,
} from '../../../src/tui/domain/app-reducer.ts';
import { emptyField } from '../../../src/tui/domain/text-input.ts';

const target = {
  locator: { kind: 'css', selector: '#go' },
  nth: null,
  framePath: [],
  description: 'Go',
} as const;

function click(offsetMs: number): RecordingEvent {
  return {
    kind: 'click',
    offsetMs,
    pageId: 'page1',
    target,
    button: 'left',
    modifiers: [],
  };
}

function entry(slug: string, name = slug): LibraryEntryView {
  return {
    kind: 'valid',
    slug,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    durationMs: 1000,
    stepCount: 2,
  };
}

const recording: Recording = {
  schemaVersion: 1,
  name: 'Demo',
  slug: 'demo',
  startUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: 'complete',
  durationMs: 100,
  viewport: { width: 1280, height: 800 },
  events: [click(0), click(100), click(200)],
};

function on(screen: Screen, nowMs = 0): AppState {
  return { ...initialState(), screen, nowMs };
}

function reduce(state: AppState, ...actions: AppAction[]): AppState {
  return actions.reduce(appReducer, state);
}

function library(count: number, selected = 0): LibraryScreen {
  return {
    kind: 'library',
    entries: Array.from({ length: count }, (_, i) => entry(`r${String(i)}`)),
    cursor: { selected, top: 0 },
    mode: { kind: 'browse' },
    error: null,
  };
}

const newForm: NewRecordingScreen = {
  kind: 'new-recording',
  name: emptyField(),
  startUrl: emptyField(),
  focus: 'name',
  error: null,
};

const idleReplay: ReplayView = {
  status: 'running',
  steps: [{ index: 0, status: 'running', driftMs: null }],
  errorMessage: null,
};

describe('src/tui/domain/app-reducer.ts', () => {
  it('starts on the setup screen while Chromium is checked', () => {
    const state = initialState();
    expect(state.screen).toMatchObject({
      kind: 'setup',
      phase: 'checking',
      lines: [],
    });
    expect(state.isQuitting).toBe(false);
  });

  describe('setup', () => {
    it('collects installer output and moves to the installing phase', () => {
      const state = reduce(
        initialState(),
        { type: 'setup-installing' },
        { type: 'setup-output', line: 'a' },
        { type: 'setup-output', line: 'b' },
      );
      const screen = state.screen as SetupScreen;
      expect(screen.phase).toBe('installing');
      expect(screen.lines).toEqual(['a', 'b']);
    });

    it('keeps only the most recent installer lines', () => {
      const lines = Array.from({ length: 80 }, (_, i) => `line ${String(i)}`);
      const state = reduce(
        initialState(),
        ...lines.map((line): AppAction => ({ type: 'setup-output', line })),
      );
      const screen = state.screen as SetupScreen;
      expect(screen.lines).toHaveLength(50);
      expect(screen.lines.at(-1)).toBe('line 79');
    });

    it('opens the main menu when ready and remembers the Linux hint', () => {
      const state = reduce(initialState(), {
        type: 'setup-ready',
        linuxHint: 'sudo x',
      });
      expect(state.screen).toEqual({ kind: 'main-menu', selected: 0 });
      expect(state.linuxHint).toBe('sudo x');
    });

    it('shows the manual command when the install failed', () => {
      const state = reduce(initialState(), {
        type: 'setup-failed',
        manualCommand: 'pnpm exec playwright install chromium',
      });
      expect(state.screen).toMatchObject({
        kind: 'setup',
        phase: 'failed',
        manualCommand: 'pnpm exec playwright install chromium',
      });
    });
  });

  describe('navigation', () => {
    it('moves between menu entries without wrapping', () => {
      const menu = on({ kind: 'main-menu', selected: 0 });
      expect(
        reduce(menu, { type: 'move-selection', delta: -1 }).screen,
      ).toEqual({ kind: 'main-menu', selected: 0 });
      expect(
        reduce(
          menu,
          { type: 'move-selection', delta: 1 },
          { type: 'move-selection', delta: 1 },
          { type: 'move-selection', delta: 1 },
        ).screen,
      ).toEqual({ kind: 'main-menu', selected: 2 });
    });

    it('navigates to a blank form, the library and back to the menu', () => {
      const base = on({ kind: 'main-menu', selected: 0 });
      expect(
        reduce(base, { type: 'navigate', target: 'new-recording' }).screen,
      ).toEqual(newForm);
      expect(
        reduce(base, { type: 'navigate', target: 'library' }).screen,
      ).toMatchObject({
        kind: 'library',
        entries: [],
        mode: { kind: 'browse' },
      });
      expect(
        reduce(on(newForm), { type: 'navigate', target: 'main-menu' }).screen,
      ).toEqual({ kind: 'main-menu', selected: 0 });
    });

    it('selects 2nd after Down, Down, Up on a library of 3', () => {
      const state = reduce(
        on(library(3)),
        { type: 'move-selection', delta: 1 },
        { type: 'move-selection', delta: 1 },
        { type: 'move-selection', delta: -1 },
      );
      expect((state.screen as LibraryScreen).cursor.selected).toBe(1);
    });

    it('scrolls a long library so the selection stays visible', () => {
      const state = reduce(
        { ...on(library(30)), listRows: 5 },
        ...Array.from({ length: 8 }, (): AppAction => ({
          type: 'move-selection',
          delta: 1,
        })),
      );
      expect((state.screen as LibraryScreen).cursor).toEqual({
        selected: 8,
        top: 4,
      });
    });

    it('pages through the library and re-fits on resize', () => {
      const paged = reduce(
        { ...on(library(30)), listRows: 10 },
        { type: 'page-selection', direction: 'down' },
      );
      expect((paged.screen as LibraryScreen).cursor.selected).toBe(9);
      const resized = reduce(
        {
          ...paged,
          screen: {
            ...(paged.screen as LibraryScreen),
            cursor: { selected: 20, top: 11 },
          },
        },
        { type: 'resize', listRows: 4 },
      );
      expect(resized.listRows).toBe(4);
      expect((resized.screen as LibraryScreen).cursor).toEqual({
        selected: 20,
        top: 17,
      });
    });

    it('scrolls the timeline screen like a list', () => {
      const screen: TimelineScreen = {
        kind: 'timeline',
        recording,
        cursor: { selected: 0, top: 0 },
      };
      const state = reduce(on(screen), { type: 'move-selection', delta: 5 });
      expect((state.screen as TimelineScreen).cursor.selected).toBe(2);
    });
  });

  describe('new recording form', () => {
    it('edits the focused field and switches focus', () => {
      const typed = reduce(
        on(newForm),
        { type: 'edit-text', edit: { kind: 'insert', text: 'D' } },
        { type: 'switch-field' },
        { type: 'edit-text', edit: { kind: 'insert', text: 'h' } },
      );
      const screen = typed.screen as NewRecordingScreen;
      expect(screen.name.value).toBe('D');
      expect(screen.startUrl.value).toBe('h');
      expect(screen.focus).toBe('url');
      expect(
        (reduce(typed, { type: 'switch-field' }).screen as NewRecordingScreen)
          .focus,
      ).toBe('name');
    });

    it('shows an inline error and clears it when the user edits again', () => {
      const failed = reduce(on(newForm), {
        type: 'form-error',
        message: 'Name is required',
      });
      expect((failed.screen as NewRecordingScreen).error).toBe(
        'Name is required',
      );
      const edited = reduce(failed, {
        type: 'edit-text',
        edit: { kind: 'insert', text: 'x' },
      });
      expect((edited.screen as NewRecordingScreen).error).toBeNull();
    });
  });

  describe('recording', () => {
    const started = reduce(on(newForm, 5000), {
      type: 'recording-started',
      name: 'Demo',
    });

    it('starts the clock at the last tick and tracks events', () => {
      const screen = started.screen as RecordingScreen;
      expect(screen).toMatchObject({
        kind: 'recording',
        name: 'Demo',
        startedAtMs: 5000,
        events: [],
      });
      const updated = reduce(started, {
        type: 'recording-updated',
        update: { events: [click(10)], pendingDialog: null, isClosed: false },
      });
      expect((updated.screen as RecordingScreen).events).toHaveLength(1);
    });

    it('seeds the prompt text from the dialog default when a dialog opens', () => {
      const dialog = {
        dialogType: 'prompt',
        message: 'Name?',
        defaultValue: 'Bob',
      } as const;
      const updated = reduce(started, {
        type: 'recording-updated',
        update: { events: [], pendingDialog: dialog, isClosed: false },
      });
      const screen = updated.screen as RecordingScreen;
      expect(screen.pendingDialog).toEqual(dialog);
      expect(screen.promptText).toEqual({ value: 'Bob', cursor: 3 });
      const typed = reduce(updated, {
        type: 'edit-text',
        edit: { kind: 'insert', text: '!' },
      });
      expect((typed.screen as RecordingScreen).promptText.value).toBe('Bob!');
    });

    it('asks before discarding and can back out', () => {
      const asking = reduce(started, { type: 'request-discard' });
      expect((asking.screen as RecordingScreen).isConfirmingDiscard).toBe(true);
      expect(
        (reduce(asking, { type: 'cancel-discard' }).screen as RecordingScreen)
          .isConfirmingDiscard,
      ).toBe(false);
    });

    it('flags the stop in progress', () => {
      expect(
        (
          reduce(started, { type: 'recording-stopping' })
            .screen as RecordingScreen
        ).isStopping,
      ).toBe(true);
    });
  });

  describe('library', () => {
    it('loads entries and keeps the selection inside the new list', () => {
      const state = reduce(on(library(5, 4)), {
        type: 'library-loaded',
        entries: [entry('a'), entry('b')],
      });
      const screen = state.screen as LibraryScreen;
      expect(screen.entries).toHaveLength(2);
      expect(screen.cursor.selected).toBe(1);
    });

    it('starts a rename with the current name and edits it', () => {
      const state = reduce(
        on({ ...library(2), entries: [entry('a', 'Alpha'), entry('b')] }),
        { type: 'begin-rename' },
        { type: 'edit-text', edit: { kind: 'insert', text: '2' } },
      );
      expect((state.screen as LibraryScreen).mode).toEqual({
        kind: 'rename',
        field: { value: 'Alpha2', cursor: 6 },
      });
    });

    it('opens the delete confirmation and cancels back to browsing', () => {
      const asking = reduce(on(library(2)), { type: 'begin-delete' });
      expect((asking.screen as LibraryScreen).mode).toEqual({
        kind: 'confirm-delete',
      });
      expect(
        (reduce(asking, { type: 'cancel-mode' }).screen as LibraryScreen).mode,
      ).toEqual({ kind: 'browse' });
    });

    it('ignores rename and delete on an empty library or an invalid entry', () => {
      const empty = on(library(0));
      expect(reduce(empty, { type: 'begin-delete' })).toEqual(empty);
      const invalid: LibraryScreen = {
        ...library(0),
        entries: [{ kind: 'invalid', slug: 'x', reason: 'bad' }],
      };
      expect(reduce(on(invalid), { type: 'begin-rename' })).toEqual(
        on(invalid),
      );
    });

    it('stores and clears an inline error', () => {
      const failed = reduce(on(library(1)), {
        type: 'library-error',
        message: 'exists',
      });
      expect((failed.screen as LibraryScreen).error).toBe('exists');
      expect(
        (
          reduce(failed, { type: 'library-error', message: null })
            .screen as LibraryScreen
        ).error,
      ).toBeNull();
    });
  });

  describe('timeline and replay', () => {
    it('opens a timeline on the first event', () => {
      const state = reduce(on(library(1)), {
        type: 'timeline-opened',
        recording,
      });
      expect(state.screen).toEqual({
        kind: 'timeline',
        recording,
        cursor: { selected: 0, top: 0 },
      });
    });

    it('starts and updates a replay', () => {
      const started = reduce(on(library(1), 900), {
        type: 'replay-started',
        recording,
        view: idleReplay,
      });
      const screen = started.screen as ReplayScreen;
      expect(screen).toMatchObject({
        kind: 'replay',
        name: 'Demo',
        startedAtMs: 900,
        events: recording.events,
      });
      const done: ReplayView = {
        status: 'succeeded',
        steps: [{ index: 0, status: 'done', driftMs: 4 }],
        errorMessage: null,
      };
      expect(
        (
          reduce(started, { type: 'replay-updated', view: done })
            .screen as ReplayScreen
        ).view,
      ).toEqual(done);
    });
  });

  it('records ticks and ignores screen actions that do not apply', () => {
    expect(reduce(initialState(), { type: 'tick', nowMs: 42 }).nowMs).toBe(42);
    const menu = on({ kind: 'main-menu', selected: 1 });
    expect(reduce(menu, { type: 'switch-field' })).toEqual(menu);
    expect(reduce(menu, { type: 'replay-updated', view: idleReplay })).toEqual(
      menu,
    );
  });

  it('marks the app as quitting', () => {
    expect(reduce(initialState(), { type: 'quit' }).isQuitting).toBe(true);
  });
});
