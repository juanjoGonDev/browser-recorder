import { describe, expect, it, vi } from 'vitest';

import { createAppStore } from '../../../src/tui/application/app-store.ts';

describe('src/tui/application/app-store.ts', () => {
  it('starts from the initial state and applies the reducer on dispatch', () => {
    const store = createAppStore();
    expect(store.getState().screen.kind).toBe('setup');
    store.dispatch({ type: 'tick', nowMs: 7 });
    expect(store.getState().nowMs).toBe(7);
  });

  it('notifies subscribers only when the state changed', () => {
    const store = createAppStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: 'tick', nowMs: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    store.dispatch({ type: 'switch-field' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const store = createAppStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.dispatch({ type: 'tick', nowMs: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});
