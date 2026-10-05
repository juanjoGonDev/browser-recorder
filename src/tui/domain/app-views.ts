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
    }
  | {
      readonly kind: 'invalid';
      readonly slug: string;
      readonly reason: string;
    };

export type EnvironmentView =
  | { readonly kind: 'ready'; readonly linuxHint: string | null }
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

export interface LiveRecordingView {
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
  subscribe(listener: (view: ReplayView) => void): () => void;
  cancel(): Promise<void>;
  readonly finished: Promise<ReplayView>;
}
