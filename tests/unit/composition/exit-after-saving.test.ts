import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exitAfterSaving } from '../../../src/composition/exit-after-saving.ts';

const DEADLINE_MS = 5000;

describe('src/composition/exit-after-saving.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exits with the code once the recording is persisted', async () => {
    const exit = vi.fn();
    const persist = vi.fn(() => Promise.resolve());
    exitAfterSaving({ persist, exit, deadlineMs: DEADLINE_MS })(130);
    expect(persist).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(0);
    expect(exit).toHaveBeenCalledExactlyOnceWith(130);
  });

  it('does not exit before the save finished', async () => {
    const exit = vi.fn();
    let finish: () => void = () => undefined;
    const persist = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    exitAfterSaving({ persist, exit, deadlineMs: DEADLINE_MS })(143);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS - 1);
    expect(exit).not.toHaveBeenCalled();
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(exit).toHaveBeenCalledExactlyOnceWith(143);
  });

  it('gives up waiting after the deadline so a stuck browser cannot trap the user', async () => {
    const exit = vi.fn();
    const persist = vi.fn(() => new Promise<void>(() => undefined));
    exitAfterSaving({ persist, exit, deadlineMs: DEADLINE_MS })(1);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('still exits when saving fails', async () => {
    const exit = vi.fn();
    const persist = vi.fn(() => Promise.reject(new Error('disk full')));
    exitAfterSaving({ persist, exit, deadlineMs: DEADLINE_MS })(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('exits once even when asked twice', async () => {
    const exit = vi.fn();
    const persist = vi.fn(() => Promise.resolve());
    const leave = exitAfterSaving({ persist, exit, deadlineMs: DEADLINE_MS });
    leave(130);
    leave(1);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    expect(exit).toHaveBeenCalledExactlyOnceWith(130);
    expect(persist).toHaveBeenCalledOnce();
  });
});
