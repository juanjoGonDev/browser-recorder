import type { ReplayTiming } from '../../shared/domain/replay-timing.ts';
import type { BrowserChoice } from '../../shared/domain/browser-choice.ts';
import type { Recording } from '../../shared/domain/recording.ts';
import type { RecordingEvent } from '../../shared/domain/recording-event.ts';
import type {
  BrowserOptionView,
  DialogView,
  LibraryEntryView,
  ReplayView,
} from './app-views.ts';

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
  /** Labels of the other browsers found, which can still record. */
  readonly browsers: readonly string[];
}

export interface MainMenuScreen {
  readonly kind: 'main-menu';
  readonly selected: number;
}

export interface NewRecordingScreen {
  readonly kind: 'new-recording';
  readonly name: TextField;
  readonly startUrl: TextField;
  readonly focus: 'name' | 'url' | 'browser' | 'profile';
  /** `null` while the browsers are still being detected. */
  readonly browsers: readonly BrowserOptionView[] | null;
  readonly browserIndex: number;
  /** An index into the profiles of the chosen browser. */
  readonly profileIndex: number;
  readonly error: string | null;
}

export interface RecordingScreen {
  readonly kind: 'recording';
  readonly name: string;
  readonly browser: BrowserChoice;
  /** Cautions raised while preparing the browser, shown for the whole run. */
  readonly warnings: readonly string[];
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
  /** How the next replay is paced; always recorded when the screen opens. */
  readonly timing: ReplayTiming;
}

export interface TimelineScreen {
  readonly kind: 'timeline';
  readonly recording: Recording;
  readonly cursor: ListCursor;
}

export interface ReplayScreen {
  readonly kind: 'replay';
  readonly name: string;
  readonly browser: BrowserChoice;
  /** For example the fallback to the bundled browser. */
  readonly warnings: readonly string[];
  readonly events: readonly RecordingEvent[];
  readonly view: ReplayView;
  /** The pacing this replay runs with. */
  readonly timing: ReplayTiming;
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
  /**
   * False after a failed install with no other browser found: only the
   * library stays usable.
   */
  readonly isBrowserAvailable: boolean;
  /** True after a failed install: the bundled browser is not offered. */
  readonly isBundledMissing: boolean;
  /** Labels of the browsers found on this machine, for the main menu. */
  readonly detectedBrowsers: readonly string[];
  readonly isQuitting: boolean;
}
