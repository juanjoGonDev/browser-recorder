import type { MonotonicClock } from '../application/ports/monotonic-clock.ts';

/** `performance.now()`: monotonic by definition, unaffected by wall clock jumps. */
export function createPerformanceClock(): MonotonicClock {
  return { now: () => performance.now() };
}
