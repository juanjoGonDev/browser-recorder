import { performance } from 'node:perf_hooks';

import type { Timers } from '../application/ports/timers.ts';

/** Real time for the TUI. Intervals are unref'd: they never keep Node alive. */
export function createNodeTimers(): Timers {
  return {
    now: () => performance.now(),
    every(intervalMs, listener) {
      const handle = setInterval(listener, intervalMs);
      handle.unref();
      return () => {
        clearInterval(handle);
      };
    },
    defer: (listener) => {
      queueMicrotask(listener);
    },
  };
}
