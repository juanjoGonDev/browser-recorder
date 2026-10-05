import type { Recording } from '../../shared/domain/recording.ts';
import type { RecordingEvent } from '../../shared/domain/recording-event.ts';
import type { DialogView, LibraryEntryView, ReplayView } from './app-views.ts';

/** A single-line editable field. `cursor` is an index into `value`. */
export interface TextField {
  readonly value: string;
  readonly cursor: number;
}

/** A selection inside a scrollable list, kept visible by `list-window`. */
export interface ListCursor {
  readonly selected: number;
  readonly top: number;
}

export interface SetupScreen {
  readonly kind: 'setup';
  readonly phase: 'checking' | 'installing' | 'failed';
  readonly lines: readonly string[];
  readonly manualCommand: string | null;
  /** The installer's exit code after a failed install, when it had one. */
  readonly exitCode: number | null;
}

export interface MainMenuScreen {
  readonly kind: 'main-menu';
  readonly selected: number;
}

export interface NewRecordingScreen {
  readonly kind: 'new-recording';
  readonly name: TextField;
  readonly startUrl: TextField;
  readonly focus: 'name' | 'url';
  readonly error: string | null;
}

export interface RecordingScreen {
  readonly kind: 'recording';
  readonly name: string;
  readonly startedAtMs: number;
  readonly events: readonly RecordingEvent[];
  readonly pendingDialog: DialogView | null;
  /** Text typed for a pending `prompt` dialog. */
  readonly promptText: TextField;
  readonly isConfirmingDiscard: boolean;
  readonly isStopping: boolean;
}

export type LibraryMode =
  | { readonly kind: 'browse' }
  | { readonly kind: 'rename'; readonly field: TextField }
  | { readonly kind: 'confirm-delete' };

export interface LibraryScreen {
  readonly kind: 'library';
  readonly entries: readonly LibraryEntryView[];
  readonly cursor: ListCursor;
  readonly mode: LibraryMode;
  readonly error: string | null;
}

export interface TimelineScreen {
  readonly kind: 'timeline';
  readonly recording: Recording;
  readonly cursor: ListCursor;
}

export interface ReplayScreen {
  readonly kind: 'replay';
  readonly name: string;
  readonly events: readonly RecordingEvent[];
  readonly view: ReplayView;
  readonly startedAtMs: number;
}

export type Screen =
  | SetupScreen
  | MainMenuScreen
  | NewRecordingScreen
  | RecordingScreen
  | LibraryScreen
  | TimelineScreen
  | ReplayScreen;

export interface AppState {
  readonly screen: Screen;
  /** Last tick of the injected timers, so renderers stay pure. */
  readonly nowMs: number;
  /** Rows a scrollable list may use; follows the terminal size. */
  readonly listRows: number;
  /** Shown on the setup screen and the main menu when relevant. */
  readonly linuxHint: string | null;
  readonly isQuitting: boolean;
}
