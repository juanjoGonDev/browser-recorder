import { describe, expect, it } from 'vitest';
import { createSignalQueue } from '../../../src/recording-capture/adapters/signal-queue.ts';

function after(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('src/recording-capture/adapters/signal-queue.ts', () => {
  it('runs tasks in the order they were queued even when an earlier one is slower', async () => {
    const queue = createSignalQueue();
    const finished: string[] = [];
    queue.enqueue(async () => {
      await after(40);
      finished.push('slow first');
    });
    queue.enqueue(() => {
      finished.push('fast second');
      return Promise.resolve();
    });
    await queue.idle();
    expect(finished).toEqual(['slow first', 'fast second']);
  });

  it('keeps going after a task fails', async () => {
    const queue = createSignalQueue();
    const finished: string[] = [];
    queue.enqueue(() => Promise.reject(new Error('page closed')));
    queue.enqueue(() => {
      finished.push('after the failure');
      return Promise.resolve();
    });
    await queue.idle();
    expect(finished).toEqual(['after the failure']);
  });

  it('is idle at once when nothing was queued, and waits for tasks queued while waiting', async () => {
    const queue = createSignalQueue();
    await queue.idle();
    let isDone = false;
    queue.enqueue(async () => {
      await after(20);
      isDone = true;
    });
    await queue.idle();
    expect(isDone).toBe(true);
  });
});
