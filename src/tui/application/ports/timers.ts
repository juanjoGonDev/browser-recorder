export type CancelTimer = () => void;

/** Time and scheduling, injected so the scheduler is testable with a fake. */
export interface Timers {
  /** Monotonic milliseconds. */
  now(): number;
  every(intervalMs: number, listener: () => void): CancelTimer;
  /** Runs once after the current synchronous work, like `queueMicrotask`. */
  defer(listener: () => void): void;
}
