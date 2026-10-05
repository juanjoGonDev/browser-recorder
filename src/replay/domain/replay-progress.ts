export type StepStatus = 'pending' | 'running' | 'done';
export type ReplayStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface StepProgress {
  readonly index: number;
  readonly status: StepStatus;
  /** The recorded offset the step should start at. */
  readonly offsetMs: number;
  /** Time from script start to the step marker, `null` until it ran. */
  readonly elapsedMs: number | null;
  /** `elapsedMs - offsetMs`, `null` until the step ran. */
  readonly driftMs: number | null;
}

/** A snapshot of a replay, rebuilt from the script's progress markers. */
export interface ReplayProgress {
  readonly status: ReplayStatus;
  readonly steps: readonly StepProgress[];
  /** Highest `::step` index seen, `null` before the first marker. */
  readonly lastStepIndex: number | null;
  readonly exitCode: number | null;
  readonly errorMessage: string | null;
  readonly stderrTail: readonly string[];
}
