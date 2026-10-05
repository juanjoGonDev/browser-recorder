import type { AppState, RecordingScreen, Screen } from './app-state.ts';
import type { Intent } from './intent.ts';
import { keyId, typedCharacter, type KeyInput } from './key-input.ts';

type KeyTable = Readonly<Record<string, Intent>>;

const QUIT: Intent = { kind: 'quit' };
const BACK: Intent = { kind: 'cancel' };
const SUBMIT: Intent = { kind: 'submit' };
const NO: Intent = { kind: 'answer-confirm', isYes: false };
const UP: Intent = { kind: 'move-selection', delta: -1 };
const DOWN: Intent = { kind: 'move-selection', delta: 1 };
const OPEN_LIBRARY: Intent = { kind: 'open', target: 'library' };
const SWITCH_FIELD: Intent = { kind: 'switch-field' };
const ACCEPT: Intent = { kind: 'respond-dialog', action: 'accept' };
const DISMISS: Intent = { kind: 'respond-dialog', action: 'dismiss' };

const LIST_KEYS: KeyTable = {
  up: UP,
  k: UP,
  down: DOWN,
  j: DOWN,
  pageup: { kind: 'page-selection', direction: 'up' },
  pagedown: { kind: 'page-selection', direction: 'down' },
};

const MENU_KEYS: KeyTable = {
  ...LIST_KEYS,
  return: { kind: 'activate' },
  q: QUIT,
};

const FORM_KEYS: KeyTable = {
  tab: SWITCH_FIELD,
  up: SWITCH_FIELD,
  down: SWITCH_FIELD,
  return: SUBMIT,
  escape: BACK,
};

const LIBRARY_KEYS: KeyTable = {
  ...LIST_KEYS,
  return: { kind: 'replay-selected' },
  p: { kind: 'replay-selected' },
  t: { kind: 'show-timeline' },
  r: { kind: 'begin-rename' },
  d: { kind: 'begin-delete' },
  n: { kind: 'open', target: 'new-recording' },
  escape: { kind: 'open', target: 'main-menu' },
  q: QUIT,
};

const RENAME_KEYS: KeyTable = { return: SUBMIT, escape: BACK };

/** Anything but an explicit `y` means no. */
const CONFIRM_KEYS: KeyTable = {
  y: { kind: 'answer-confirm', isYes: true },
  n: NO,
  return: NO,
  escape: NO,
};

const RECORDING_KEYS: KeyTable = {
  s: { kind: 'stop-recording' },
  x: { kind: 'request-discard' },
};

const DIALOG_KEYS: KeyTable = { a: ACCEPT, d: DISMISS };
const PROMPT_KEYS: KeyTable = { return: ACCEPT, escape: DISMISS };
const TIMELINE_KEYS: KeyTable = { ...LIST_KEYS, escape: BACK };
const RUNNING_REPLAY_KEYS: KeyTable = {
  c: { kind: 'cancel-replay' },
  escape: { kind: 'cancel-replay' },
};
const FINISHED_REPLAY_KEYS: KeyTable = { escape: BACK };

const EDIT_KEYS: KeyTable = {
  left: { kind: 'edit-text', edit: { kind: 'move', direction: 'left' } },
  right: { kind: 'edit-text', edit: { kind: 'move', direction: 'right' } },
  backspace: { kind: 'edit-text', edit: { kind: 'backspace' } },
  'ctrl+u': { kind: 'edit-text', edit: { kind: 'clear-line' } },
};

function lookup(table: KeyTable, key: KeyInput): Intent | null {
  return Object.hasOwn(table, keyId(key)) ? (table[keyId(key)] ?? null) : null;
}

/** Text editing keys: the table first, then any typed character. */
function edit(key: KeyInput): Intent | null {
  const fromTable = lookup(EDIT_KEYS, key);
  if (fromTable !== null) return fromTable;
  const text = typedCharacter(key);
  return text === null
    ? null
    : { kind: 'edit-text', edit: { kind: 'insert', text } };
}

function textOr(table: KeyTable, key: KeyInput): Intent | null {
  return lookup(table, key) ?? edit(key);
}

function forSetup(screen: Screen, key: KeyInput): Intent | null {
  const isRetry = screen.kind === 'setup' && screen.phase === 'failed';
  if (isRetry && keyId(key) === 'return') return { kind: 'retry-setup' };
  if (isRetry && keyId(key) === 'l') return OPEN_LIBRARY;
  return keyId(key) === 'q' ? QUIT : null;
}

function forRecording(screen: RecordingScreen, key: KeyInput): Intent | null {
  if (screen.isStopping) return null;
  if (screen.isConfirmingDiscard) return lookup(CONFIRM_KEYS, key);
  if (screen.pendingDialog === null) return lookup(RECORDING_KEYS, key);
  if (screen.pendingDialog.dialogType === 'prompt') {
    return textOr(PROMPT_KEYS, key);
  }
  return lookup(DIALOG_KEYS, key);
}

function forLibrary(screen: Screen, key: KeyInput): Intent | null {
  if (screen.kind !== 'library') return null;
  switch (screen.mode.kind) {
    case 'browse':
      return lookup(LIBRARY_KEYS, key);
    case 'rename':
      return textOr(RENAME_KEYS, key);
    case 'confirm-delete':
      return lookup(CONFIRM_KEYS, key);
  }
}

function forScreen(screen: Screen, key: KeyInput): Intent | null {
  switch (screen.kind) {
    case 'setup':
      return forSetup(screen, key);
    case 'main-menu':
      return lookup(MENU_KEYS, key);
    case 'new-recording':
      return textOr(FORM_KEYS, key);
    case 'recording':
      return forRecording(screen, key);
    case 'library':
      return forLibrary(screen, key);
    case 'timeline':
      return lookup(TIMELINE_KEYS, key);
    case 'replay':
      return lookup(
        screen.view.status === 'running'
          ? RUNNING_REPLAY_KEYS
          : FINISHED_REPLAY_KEYS,
        key,
      );
  }
}

/** What a key press means on the current screen; pure, `null` when nothing. */
export function keymap(state: AppState, key: KeyInput): Intent | null {
  if (keyId(key) === 'ctrl+c') return QUIT;
  return forScreen(state.screen, key);
}
