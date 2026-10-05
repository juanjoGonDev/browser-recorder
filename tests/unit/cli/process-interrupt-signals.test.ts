import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { createProcessInterruptSignals } from '../../../src/cli/adapters/process-interrupt-signals.ts';

describe('src/cli/adapters/process-interrupt-signals.ts', () => {
  it('reports SIGINT and SIGTERM by name', () => {
    const source = new EventEmitter();
    const handler = vi.fn();
    createProcessInterruptSignals({ source, platform: 'linux' }).listen(
      handler,
    );
    source.emit('SIGINT');
    source.emit('SIGTERM');
    expect(handler.mock.calls).toStrictEqual([['SIGINT'], ['SIGTERM']]);
  });

  it('listens for SIGBREAK only on Windows', () => {
    const posix = new EventEmitter();
    const windows = new EventEmitter();
    createProcessInterruptSignals({ source: posix, platform: 'linux' }).listen(
      vi.fn(),
    );
    const handler = vi.fn();
    createProcessInterruptSignals({
      source: windows,
      platform: 'win32',
    }).listen(handler);
    expect(posix.listenerCount('SIGBREAK')).toBe(0);
    windows.emit('SIGBREAK');
    expect(handler).toHaveBeenCalledWith('SIGBREAK');
  });

  it('removes every listener when stopped', () => {
    const source = new EventEmitter();
    const stop = createProcessInterruptSignals({
      source,
      platform: 'win32',
    }).listen(vi.fn());
    expect(source.listenerCount('SIGINT')).toBe(1);
    stop();
    for (const name of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
      expect(source.listenerCount(name)).toBe(0);
    }
  });
});
