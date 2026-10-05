import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNodeTimers } from '../../../src/tui/adapters/node-timers.ts';

describe('src/tui/adapters/node-timers.ts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads a monotonic clock in milliseconds', () => {
    const timers = createNodeTimers();
    const first = timers.now();
    const second = timers.now();
    expect(Number.isFinite(first)).toBe(true);
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it('runs an interval listener until it is cancelled', () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const cancel = createNodeTimers().every(250, listener);
    vi.advanceTimersByTime(750);
    expect(listener).toHaveBeenCalledTimes(3);
    cancel();
    vi.advanceTimersByTime(750);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('defers work until the current synchronous code is done', async () => {
    const order: string[] = [];
    createNodeTimers().defer(() => order.push('deferred'));
    order.push('sync');
    await Promise.resolve();
    expect(order).toEqual(['sync', 'deferred']);
  });
});
