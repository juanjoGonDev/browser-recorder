import type { RecordingEvent } from '../../shared/domain/recording-event.ts';
import type { Recording } from '../../shared/domain/recording.ts';
import type {
  BrowserLauncher,
  BrowserSession,
  SessionSignal,
} from './ports/browser-launcher.ts';
import type { MonotonicClock } from './ports/monotonic-clock.ts';
import type { RecordingSink } from './ports/recording-sink.ts';

export interface RecordingUpdate {
  readonly events: readonly RecordingEvent[];
  readonly pendingDialog: SessionSignal | null;
  readonly isClosed: boolean;
}

export interface LiveRecording {
  subscribe(listener: (update: RecordingUpdate) => void): () => void;
  respondToDialog: BrowserSession['respondToDialog'];
  stop(): Promise<Recording>;
  discard(): Promise<void>;
}

export interface StartRecordingDeps {
  readonly launcher: BrowserLauncher;
  readonly clock: MonotonicClock;
  readonly sink: RecordingSink;
  readonly now: () => Date;
}

export interface StartRecordingRequest {
  readonly name: string;
  readonly slug: string;
  readonly startUrl: string | null;
}

// Frozen signature: work package WP1 replaces this declaration with the
// implementation, keeping the signature unchanged.
export declare function startRecording(
  deps: StartRecordingDeps,
  request: StartRecordingRequest,
): Promise<LiveRecording>;
