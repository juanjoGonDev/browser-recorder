import type {
  LiveRecording,
  RecordingUpdate,
} from '../recording-capture/application/recording-session.ts';
import type {
  DialogView,
  LiveRecordingView,
  RecordingUpdateView,
} from '../tui/domain/app-views.ts';

function toDialogView(update: RecordingUpdate): DialogView | null {
  const dialog = update.pendingDialog;
  if (dialog?.kind !== 'dialog-opened') return null;
  return {
    dialogType: dialog.dialogType,
    message: dialog.message,
    defaultValue: dialog.defaultValue,
  };
}

export function toRecordingUpdateView(
  update: RecordingUpdate,
): RecordingUpdateView {
  return {
    events: update.events,
    pendingDialog: toDialogView(update),
    isClosed: update.isClosed,
  };
}

export interface RecordingViewHooks {
  /** Saves and ends the session. */
  readonly stop: () => Promise<void>;
  /** Ends the session and deletes what was saved so far. */
  readonly discard: () => Promise<void>;
}

export function toLiveRecordingView(
  live: LiveRecording,
  hooks: RecordingViewHooks,
): LiveRecordingView {
  return {
    subscribe: (listener) =>
      live.subscribe((update) => {
        listener(toRecordingUpdateView(update));
      }),
    respondToDialog: (response) => live.respondToDialog(response),
    stop: hooks.stop,
    discard: hooks.discard,
  };
}
