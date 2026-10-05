import type {
  BrowserChoice,
  BrowserId,
} from '../../shared/domain/browser-choice.ts';
import type {
  DialogType,
  RecordingEvent,
} from '../../shared/domain/recording-event.ts';

/** The TUI's own view of a library entry; composition adapts the real one. */
export type LibraryEntryView =
  | {
      readonly kind: 'valid';
      readonly slug: string;
      readonly name: string;
      readonly createdAt: string;
      readonly durationMs: number;
      readonly stepCount: number;
      /** What the recording ran on; absent when the source cannot tell. */
      readonly browser?: BrowserChoice;
    }
  | {
      readonly kind: 'invalid';
      readonly slug: string;
      readonly reason: string;
    };

export type EnvironmentView =
  | {
      readonly kind: 'ready';
      readonly linuxHint: string | null;
      /** Labels of the browsers found on this machine. */
      readonly browsers: readonly string[];
    }
  | {
      readonly kind: 'failed';
      readonly manualCommand: string;
      readonly exitCode: number | null;
    };

export interface DialogView {
  readonly dialogType: DialogType;
  readonly message: string;
  readonly defaultValue: string;
}

export interface RecordingUpdateView {
  readonly events: readonly RecordingEvent[];
  readonly pendingDialog: DialogView | null;
  readonly isClosed: boolean;
}

/** One way to provide the profile of a browser, as the picker lists it. */
export interface ProfileOptionView {
  readonly choice: BrowserChoice;
  readonly label: string;
  /** A caution to show next to the option, if any. */
  readonly note: string | null;
}

export interface BrowserOptionView {
  readonly browserId: BrowserId;
  readonly label: string;
  readonly profiles: readonly ProfileOptionView[];
}

export interface LiveRecordingView {
  /** Cautions raised while preparing the browser (for example a stale copy). */
  readonly warnings: readonly string[];
  subscribe(listener: (update: RecordingUpdateView) => void): () => void;
  respondToDialog(response: {
    readonly action: 'accept' | 'dismiss';
    readonly promptText: string | null;
  }): Promise<void>;
  /** Saves and ends the session. */
  stop(): Promise<void>;
  discard(): Promise<void>;
}

export interface ReplayStepView {
  readonly index: number;
  readonly status: 'pending' | 'running' | 'done';
  readonly driftMs: number | null;
}

export interface ReplayView {
  readonly status: 'running' | 'succeeded' | 'failed' | 'cancelled';
  readonly steps: readonly ReplayStepView[];
  readonly errorMessage: string | null;
}

export interface LiveReplayView {
  readonly warnings: readonly string[];
  subscribe(listener: (view: ReplayView) => void): () => void;
  cancel(): Promise<void>;
  readonly finished: Promise<ReplayView>;
}
