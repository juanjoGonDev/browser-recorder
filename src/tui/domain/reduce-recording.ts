import type { AppAction } from './app-action.ts';
import type { AppState, RecordingScreen } from './app-state.ts';
import type { RecordingUpdateView } from './app-views.ts';
import { updateScreen } from './screen-update.ts';
import { emptyField } from './text-input.ts';

type RecordingUpdate = (screen: RecordingScreen) => RecordingScreen;

export function onRecording(
  state: AppState,
  update: RecordingUpdate,
): AppState {
  return updateScreen(state, 'recording', update);
}

export function recordingStarted(
  state: AppState,
  started: Extract<AppAction, { type: 'recording-started' }>,
): AppState {
  return {
    ...state,
    screen: {
      kind: 'recording',
      name: started.name,
      browser: started.browser,
      warnings: started.warnings,
      startedAtMs: state.nowMs,
      events: [],
      pendingDialog: null,
      promptText: emptyField(),
      isConfirmingDiscard: false,
      isStopping: false,
    },
  };
}

export function recordingUpdated(
  state: AppState,
  update: RecordingUpdateView,
): AppState {
  return onRecording(state, (screen) => {
    const dialog = update.pendingDialog;
    const isNewDialog = dialog !== null && dialog !== screen.pendingDialog;
    return {
      ...screen,
      events: update.events,
      pendingDialog: dialog,
      promptText: isNewDialog
        ? emptyField(dialog.defaultValue)
        : screen.promptText,
    };
  });
}

export function setStopping(state: AppState): AppState {
  return onRecording(state, (screen) => ({ ...screen, isStopping: true }));
}

export function setConfirmingDiscard(
  state: AppState,
  isConfirmingDiscard: boolean,
): AppState {
  return onRecording(state, (screen) => ({ ...screen, isConfirmingDiscard }));
}
