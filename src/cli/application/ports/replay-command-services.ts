import type { RecordingEvent } from '../../../shared/domain/recording-event.ts';
import type { ReplayTiming } from '../../../shared/domain/replay-timing.ts';
import type { RecordingChoice } from '../../domain/find-recording.ts';

export type RunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface RunStepView {
  readonly index: number;
  readonly status: 'pending' | 'running' | 'done';
  readonly elapsedMs: number | null;
}

/** What the command needs to know of a replay; composition adapts it. */
export interface RunView {
  readonly status: RunStatus;
  readonly steps: readonly RunStepView[];
  /** Highest step the script reported, `null` before the first. */
  readonly lastStepIndex: number | null;
  readonly errorMessage: string | null;
  /** Non-fatal notes the script printed, shown after the run. */
  readonly warnings: readonly string[];
  readonly stderrTail: readonly string[];
}

export interface ReplayRun {
  readonly name: string;
  readonly events: readonly RecordingEvent[];
  /** Cautions raised while preparing the browser. */
  readonly warnings: readonly string[];
  subscribe(listener: (view: RunView) => void): () => void;
  cancel(): Promise<void>;
  readonly finished: Promise<RunView>;
  /** Settles once the profile copy of the run was deleted. */
  readonly released: Promise<void>;
}

export interface StartOptions {
  readonly timing: ReplayTiming;
  readonly isHeadless: boolean;
}

/**
 * Everything the command asks of the application. Implemented only in
 * `src/composition/`; tests use fakes.
 */
export interface ReplayCommandServices {
  listRecordings(): Promise<readonly RecordingChoice[]>;
  /** Rejects with a message that is safe to print. */
  startReplay(slug: string, options: StartOptions): Promise<ReplayRun>;
  /** A monotonic clock in milliseconds. */
  now(): number;
}
