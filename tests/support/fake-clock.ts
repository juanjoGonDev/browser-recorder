import type { MonotonicClock } from '../../src/recording-capture/application/ports/monotonic-clock.ts';
import type {
  CancelTimer,
  Timers,
} from '../../src/tui/application/ports/timers.ts';

export interface FakeClock extends MonotonicClock {
  advance(ms: number): void;
  /** Sets the time directly, including backward, to model a clock jump. */
  setTime(ms: number): void;
  /** Called after every `advance` with the time before and after it. */
  onAdvance(listener: (fromMs: number, toMs: number) => void): void;
}

export interface FakeTimers extends Timers {
  /** Runs every deferred listener queued so far, in order. */
  flushDeferred(): void;
}

interface Interval {
  readonly intervalMs: number;
  readonly listener: () => void;
  nextAt: number;
  isCancelled: boolean;
}

export function createFakeClock(startMs = 0): FakeClock {
  let current = startMs;
  const advanceListeners: ((fromMs: number, toMs: number) => void)[] = [];
  return {
    now: () => current,
    advance(ms) {
      const fromMs = current;
      current += ms;
      for (const listener of advanceListeners) listener(fromMs, current);
    },
    setTime(ms) {
      current = ms;
    },
    onAdvance(listener) {
      advanceListeners.push(listener);
    },
  };
}

function runDueIntervals(intervals: readonly Interval[], toMs: number): void {
  for (const interval of intervals) {
    while (!interval.isCancelled && interval.nextAt <= toMs) {
      interval.nextAt += interval.intervalMs;
      interval.listener();
    }
  }
}

export function createFakeTimers(clock: FakeClock): FakeTimers {
  const intervals: Interval[] = [];
  let deferred: (() => void)[] = [];
  clock.onAdvance((_fromMs, toMs) => {
    runDueIntervals(intervals, toMs);
  });
  return {
    now: () => clock.now(),
    every(intervalMs, listener): CancelTimer {
      const interval: Interval = {
        intervalMs,
        listener,
        nextAt: clock.now() + intervalMs,
        isCancelled: false,
      };
      intervals.push(interval);
      return () => {
        interval.isCancelled = true;
      };
    },
    defer(listener) {
      deferred.push(listener);
    },
    flushDeferred() {
      const queued = deferred;
      deferred = [];
      for (const listener of queued) listener();
    },
  };
}
