import { describe, expect, it } from 'vitest';

import type { KeyInput } from '../../../src/tui/domain/key-input.ts';
import type {
  AppState,
  LibraryScreen,
  RecordingScreen,
  Screen,
} from '../../../src/tui/domain/app-state.ts';
import type { Intent } from '../../../src/tui/domain/intent.ts';
import { initialState } from '../../../src/tui/domain/app-reducer.ts';
import { keymap } from '../../../src/tui/domain/keymap.ts';
import { emptyField } from '../../../src/tui/domain/text-input.ts';

function named(name: string, modifiers: Partial<KeyInput> = {}): KeyInput {
  return {
    name,
    sequence: name,
    ctrl: false,
    meta: false,
    shift: false,
    ...modifiers,
  };
}

function char(text: string): KeyInput {
  return { name: null, sequence: text, ctrl: false, meta: false, shift: false };
}

function on(screen: Screen): AppState {
  return { ...initialState(), screen };
}

const recording: RecordingScreen = {
  kind: 'recording',
  name: 'Demo',
  startedAtMs: 0,
  events: [],
  pendingDialog: null,
  promptText: emptyField(),
  isConfirmingDiscard: false,
  isStopping: false,
};

const library: LibraryScreen = {
  kind: 'library',
  entries: [],
  cursor: { selected: 0, top: 0 },
  mode: { kind: 'browse' },
  error: null,
};

function press(state: AppState, key: KeyInput): Intent | null {
  return keymap(state, key);
}

describe('src/tui/domain/keymap.ts', () => {
  it('quits on Ctrl+C from every screen', () => {
    const ctrlC = named('c', { ctrl: true });
    for (const screen of [initialState().screen, recording, library]) {
      expect(press(on(screen), ctrlC)).toEqual({ kind: 'quit' });
    }
  });

  describe('setup', () => {
    const failed = on({
      kind: 'setup',
      phase: 'failed',
      lines: [],
      manualCommand: 'x',
      exitCode: 1,
    });

    it('retries on Enter only after a failure and quits on q', () => {
      expect(press(failed, named('return'))).toEqual({ kind: 'retry-setup' });
      expect(press(initialState(), named('return'))).toBeNull();
      expect(press(failed, char('q'))).toEqual({ kind: 'quit' });
    });
  });

  describe('main menu', () => {
    const menu = on({ kind: 'main-menu', selected: 0 });

    it('moves with arrows and vim keys, activates with Enter, quits with q', () => {
      expect(press(menu, named('down'))).toEqual({
        kind: 'move-selection',
        delta: 1,
      });
      expect(press(menu, char('j'))).toEqual({
        kind: 'move-selection',
        delta: 1,
      });
      expect(press(menu, named('up'))).toEqual({
        kind: 'move-selection',
        delta: -1,
      });
      expect(press(menu, char('k'))).toEqual({
        kind: 'move-selection',
        delta: -1,
      });
      expect(press(menu, named('return'))).toEqual({ kind: 'activate' });
      expect(press(menu, char('q'))).toEqual({ kind: 'quit' });
      expect(press(menu, char('z'))).toBeNull();
    });
  });

  describe('new recording form', () => {
    const form = on({
      kind: 'new-recording',
      name: emptyField(),
      startUrl: emptyField(),
      focus: 'name',
      error: null,
    });

    it('edits text with typing, backspace, arrows and Ctrl+U', () => {
      expect(press(form, char('q'))).toEqual({
        kind: 'edit-text',
        edit: { kind: 'insert', text: 'q' },
      });
      expect(press(form, named('backspace'))).toEqual({
        kind: 'edit-text',
        edit: { kind: 'backspace' },
      });
      expect(press(form, named('left'))).toEqual({
        kind: 'edit-text',
        edit: { kind: 'move', direction: 'left' },
      });
      expect(press(form, named('right'))).toEqual({
        kind: 'edit-text',
        edit: { kind: 'move', direction: 'right' },
      });
      expect(press(form, named('u', { ctrl: true }))).toEqual({
        kind: 'edit-text',
        edit: { kind: 'clear-line' },
      });
    });

    it('switches fields, submits and goes back', () => {
      expect(press(form, named('tab'))).toEqual({ kind: 'switch-field' });
      expect(press(form, named('down'))).toEqual({ kind: 'switch-field' });
      expect(press(form, named('up'))).toEqual({ kind: 'switch-field' });
      expect(press(form, named('return'))).toEqual({ kind: 'submit' });
      expect(press(form, named('escape'))).toEqual({ kind: 'cancel' });
    });

    it('does not insert modified keys or named keys as text', () => {
      expect(press(form, named('x', { meta: true }))).toBeNull();
      expect(press(form, named('f5'))).toBeNull();
    });
  });

  describe('recording', () => {
    it('stops with s and asks before discarding with x', () => {
      expect(press(on(recording), char('s'))).toEqual({
        kind: 'stop-recording',
      });
      expect(press(on(recording), char('x'))).toEqual({
        kind: 'request-discard',
      });
      expect(press(on(recording), char('z'))).toBeNull();
    });

    it('defaults the discard prompt to no', () => {
      const asking = on({ ...recording, isConfirmingDiscard: true });
      expect(press(asking, char('y'))).toEqual({
        kind: 'answer-confirm',
        isYes: true,
      });
      expect(press(asking, char('n'))).toEqual({
        kind: 'answer-confirm',
        isYes: false,
      });
      expect(press(asking, named('return'))).toEqual({
        kind: 'answer-confirm',
        isYes: false,
      });
      expect(press(asking, named('escape'))).toEqual({
        kind: 'answer-confirm',
        isYes: false,
      });
      expect(press(asking, char('s'))).toBeNull();
    });

    it('answers a confirm dialog with a and d', () => {
      const dialog = on({
        ...recording,
        pendingDialog: {
          dialogType: 'confirm',
          message: 'Sure?',
          defaultValue: '',
        },
      });
      expect(press(dialog, char('a'))).toEqual({
        kind: 'respond-dialog',
        action: 'accept',
      });
      expect(press(dialog, char('d'))).toEqual({
        kind: 'respond-dialog',
        action: 'dismiss',
      });
      expect(press(dialog, char('s'))).toBeNull();
    });

    it('lets the user type the answer of a prompt dialog', () => {
      const prompt = on({
        ...recording,
        pendingDialog: {
          dialogType: 'prompt',
          message: 'Name?',
          defaultValue: '',
        },
      });
      expect(press(prompt, char('a'))).toEqual({
        kind: 'edit-text',
        edit: { kind: 'insert', text: 'a' },
      });
      expect(press(prompt, named('return'))).toEqual({
        kind: 'respond-dialog',
        action: 'accept',
      });
      expect(press(prompt, named('escape'))).toEqual({
        kind: 'respond-dialog',
        action: 'dismiss',
      });
    });

    it('ignores keys while stopping', () => {
      expect(
        press(on({ ...recording, isStopping: true }), char('s')),
      ).toBeNull();
    });
  });

  describe('library', () => {
    it('navigates and triggers the actions', () => {
      const browse = on(library);
      expect(press(browse, named('down'))).toEqual({
        kind: 'move-selection',
        delta: 1,
      });
      expect(press(browse, named('pagedown'))).toEqual({
        kind: 'page-selection',
        direction: 'down',
      });
      expect(press(browse, named('pageup'))).toEqual({
        kind: 'page-selection',
        direction: 'up',
      });
      expect(press(browse, named('return'))).toEqual({
        kind: 'replay-selected',
      });
      expect(press(browse, char('p'))).toEqual({ kind: 'replay-selected' });
      expect(press(browse, char('t'))).toEqual({ kind: 'show-timeline' });
      expect(press(browse, char('r'))).toEqual({ kind: 'begin-rename' });
      expect(press(browse, char('d'))).toEqual({ kind: 'begin-delete' });
      expect(press(browse, char('n'))).toEqual({
        kind: 'open',
        target: 'new-recording',
      });
      expect(press(browse, named('escape'))).toEqual({
        kind: 'open',
        target: 'main-menu',
      });
      expect(press(browse, char('q'))).toEqual({ kind: 'quit' });
    });

    it('edits the name inline while renaming', () => {
      const rename = on({
        ...library,
        mode: { kind: 'rename', field: emptyField('a') },
      });
      expect(press(rename, char('q'))).toEqual({
        kind: 'edit-text',
        edit: { kind: 'insert', text: 'q' },
      });
      expect(press(rename, named('return'))).toEqual({ kind: 'submit' });
      expect(press(rename, named('escape'))).toEqual({ kind: 'cancel' });
    });

    it('never deletes without an explicit y', () => {
      const confirm = on({ ...library, mode: { kind: 'confirm-delete' } });
      expect(press(confirm, char('y'))).toEqual({
        kind: 'answer-confirm',
        isYes: true,
      });
      expect(press(confirm, char('n'))).toEqual({
        kind: 'answer-confirm',
        isYes: false,
      });
      expect(press(confirm, named('return'))).toEqual({
        kind: 'answer-confirm',
        isYes: false,
      });
      expect(press(confirm, named('escape'))).toEqual({
        kind: 'answer-confirm',
        isYes: false,
      });
      expect(press(confirm, char('q'))).toBeNull();
    });
  });

  describe('timeline and replay', () => {
    const timeline = on({
      kind: 'timeline',
      recording: {
        schemaVersion: 1,
        name: 'n',
        slug: 'n',
        startUrl: null,
        createdAt: '',
        updatedAt: '',
        status: 'complete',
        durationMs: 0,
        viewport: { width: 1, height: 1 },
        events: [],
      },
      cursor: { selected: 0, top: 0 },
    });
    const replay = (status: 'running' | 'succeeded'): AppState =>
      on({
        kind: 'replay',
        name: 'n',
        events: [],
        startedAtMs: 0,
        view: { status, steps: [], errorMessage: null },
      });

    it('scrolls the timeline and goes back with Escape', () => {
      expect(press(timeline, named('up'))).toEqual({
        kind: 'move-selection',
        delta: -1,
      });
      expect(press(timeline, named('pagedown'))).toEqual({
        kind: 'page-selection',
        direction: 'down',
      });
      expect(press(timeline, named('escape'))).toEqual({ kind: 'cancel' });
    });

    it('cancels a running replay and leaves a finished one', () => {
      expect(press(replay('running'), char('c'))).toEqual({
        kind: 'cancel-replay',
      });
      expect(press(replay('running'), named('escape'))).toEqual({
        kind: 'cancel-replay',
      });
      expect(press(replay('succeeded'), named('escape'))).toEqual({
        kind: 'cancel',
      });
      expect(press(replay('succeeded'), char('c'))).toBeNull();
    });
  });
});
