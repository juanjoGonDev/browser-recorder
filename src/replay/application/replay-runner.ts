import type { ReplayProgress } from '../domain/replay-progress.ts';
import type { ProcessSpawner } from './ports/process-spawner.ts';

export interface LiveReplay {
  subscribe(listener: (progress: ReplayProgress) => void): () => void;
  cancel(): Promise<void>;
  readonly finished: Promise<ReplayProgress>;
}

export interface StartReplayDeps {
  readonly spawner: ProcessSpawner;
  readonly nodePath: string;
  readonly cancelGraceMs: number;
}

export interface StartReplayRequest {
  readonly scriptPath: string;
  readonly cwd: string;
  readonly isHeadless: boolean;
  /** Recorded offset of every step, in order: drift is `elapsed - offset`. */
  readonly stepOffsetsMs: readonly number[];
}

// Frozen signature: work package WP5 replaces this declaration with the
// implementation. `stepOffsetsMs` is the one addition to the design snapshot
// of this request: the runner needs the offsets to report per-step drift.
export declare function startReplay(
  deps: StartReplayDeps,
  request: StartReplayRequest,
): LiveReplay;
