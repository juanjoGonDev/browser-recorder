import { describe, expect, it } from 'vitest';
import { createPerformanceClock } from '../../../src/recording-capture/adapters/performance-clock.ts';

const SLEEP_MS = 30;

describe('src/recording-capture/adapters/performance-clock.ts', () => {
  it('never moves backward across many reads', () => {
    const clock = createPerformanceClock();
    let previous = clock.now();
    for (let read = 0; read < 1000; read += 1) {
      const current = clock.now();
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('tracks real elapsed time', async () => {
    const clock = createPerformanceClock();
    const before = clock.now();
    await new Promise((resolve) => setTimeout(resolve, SLEEP_MS));
    expect(clock.now() - before).toBeGreaterThanOrEqual(SLEEP_MS - 5);
    expect(clock.now() - before).toBeLessThan(SLEEP_MS * 10);
  });
});
