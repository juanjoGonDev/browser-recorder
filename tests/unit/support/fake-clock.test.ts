import { describe, expect, it, vi } from 'vitest';
import { createFakeClock, createFakeTimers } from '../../support/fake-clock.ts';

describe('tests/support/fake-clock.ts', () => {
  describe('createFakeClock', () => {
    it('starts at the given time and only moves when advanced', () => {
      const clock = createFakeClock(1000);
      expect(clock.now()).toBe(1000);
      clock.advance(250);
      expect(clock.now()).toBe(1250);
    });

    it('can jump backward to model a wall clock correction', () => {
      const clock = createFakeClock(5000);
      clock.setTime(4000);
      expect(clock.now()).toBe(4000);
    });
  });

  describe('createFakeTimers', () => {
    it('reports the clock time as its own', () => {
      const clock = createFakeClock(40);
      expect(createFakeTimers(clock).now()).toBe(40);
    });

    it('fires an interval once per elapsed period', () => {
      const clock = createFakeClock();
      const timers = createFakeTimers(clock);
      const listener = vi.fn();
      timers.every(250, listener);

      clock.advance(249);
      expect(listener).not.toHaveBeenCalled();
      clock.advance(1);
      expect(listener).toHaveBeenCalledTimes(1);
      clock.advance(750);
      expect(listener).toHaveBeenCalledTimes(4);
    });

    it('stops an interval once it is cancelled', () => {
      const clock = createFakeClock();
      const timers = createFakeTimers(clock);
      const listener = vi.fn();
      const cancel = timers.every(100, listener);

      clock.advance(100);
      cancel();
      clock.advance(1000);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('runs deferred work only when flushed, in order', () => {
      const timers = createFakeTimers(createFakeClock());
      const order: string[] = [];
      timers.defer(() => order.push('first'));
      timers.defer(() => order.push('second'));
      expect(order).toEqual([]);

      timers.flushDeferred();
      expect(order).toEqual(['first', 'second']);
      timers.flushDeferred();
      expect(order).toEqual(['first', 'second']);
    });
  });
});
