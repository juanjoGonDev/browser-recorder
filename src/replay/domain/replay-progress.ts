import type { ProgressMessage } from './parse-progress-line.ts';

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
  /** `false` in human timing, where offsets mean nothing and drift stays null. */
  readonly isDriftTracked: boolean;
  readonly steps: readonly StepProgress[];
  /** Highest `::step` index seen, `null` before the first marker. */
  readonly lastStepIndex: number | null;
  readonly exitCode: number | null;
  readonly errorMessage: string | null;
  readonly stderrTail: readonly string[];
}

export const STDERR_TAIL_LINES = 10;
const EXIT_SUCCESS = 0;

export interface ReplayProgressOptions {
  readonly isDriftTracked: boolean;
}

export function createReplayProgress(
  stepOffsetsMs: readonly number[],
  options: ReplayProgressOptions = { isDriftTracked: true },
): ReplayProgress {
  return {
    status: 'running',
    isDriftTracked: options.isDriftTracked,
    steps: stepOffsetsMs.map((offsetMs, index) => ({
      index,
      status: 'pending',
      offsetMs,
      elapsedMs: null,
      driftMs: null,
    })),
    lastStepIndex: null,
    exitCode: null,
    errorMessage: null,
    stderrTail: [],
  };
}

type StepMessage = Extract<ProgressMessage, { kind: 'step' }>;

function reachStep(
  step: StepProgress,
  reached: StepMessage,
  isDriftTracked: boolean,
): StepProgress {
  if (step.index < reached.index) return { ...step, status: 'done' };
  if (step.index > reached.index) return step;
  const { elapsedMs } = reached;
  return {
    ...step,
    status: 'running',
    elapsedMs,
    driftMs:
      elapsedMs === null || !isDriftTracked ? null : elapsedMs - step.offsetMs,
  };
}

/** Folds one parsed stdout line into the snapshot. */
export function applyMessage(
  progress: ReplayProgress,
  message: ProgressMessage,
): ReplayProgress {
  switch (message.kind) {
    case 'step':
      return {
        ...progress,
        lastStepIndex: message.index,
        steps: progress.steps.map((step) =>
          reachStep(step, message, progress.isDriftTracked),
        ),
      };
    case 'done':
      return {
        ...progress,
        steps: progress.steps.map((step) => ({ ...step, status: 'done' })),
      };
    case 'error':
      return { ...progress, errorMessage: message.message };
    case 'log':
      return progress;
  }
}

export function applyStderrLine(
  progress: ReplayProgress,
  line: string,
): ReplayProgress {
  return {
    ...progress,
    stderrTail: [...progress.stderrTail, line].slice(-STDERR_TAIL_LINES),
  };
}

function exitStatus(
  exitCode: number | null,
  isCancelled: boolean,
): ReplayStatus {
  if (isCancelled) return 'cancelled';
  return exitCode === EXIT_SUCCESS ? 'succeeded' : 'failed';
}

function failureMessage(
  progress: ReplayProgress,
  status: ReplayStatus,
  exitCode: number | null,
): string | null {
  if (status !== 'failed') return progress.errorMessage;
  if (progress.errorMessage !== null) return progress.errorMessage;
  return exitCode === null
    ? 'The replay was terminated by a signal.'
    : `The replay exited with code ${String(exitCode)}.`;
}

/** Settles the snapshot once the child process has exited. */
export function applyExit(
  progress: ReplayProgress,
  exitCode: number | null,
  isCancelled: boolean,
): ReplayProgress {
  const status = exitStatus(exitCode, isCancelled);
  return {
    ...progress,
    status,
    exitCode,
    errorMessage: failureMessage(progress, status, exitCode),
  };
}
