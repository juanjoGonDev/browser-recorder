import { describe, expect, it, vi } from 'vitest';

import { createAppStore } from '../../../src/tui/application/app-store.ts';
import { createFrameScheduler } from '../../../src/tui/application/frame-scheduler.ts';
import type { Screen } from '../../../src/tui/domain/app-state.ts';
import { initialState } from '../../../src/tui/domain/app-reducer.ts';
import { createFakeClock, createFakeTimers } from '../../support/fake-clock.ts';
import { BRAVE_CHOICE } from '../../support/browser-fixtures.ts';

function setup(screen: Screen) {
  const clock = createFakeClock(1000);
  const timers = createFakeTimers(clock);
  const store = createAppStore({ ...initialState(), screen, nowMs: 1000 });
  const draw = vi.fn();
  const refreshLibrary = vi.fn();
  const scheduler = createFrameScheduler({
    timers,
    store,
    draw,
    refreshLibrary,
  });
  return { clock, timers, store, draw, refreshLibrary, scheduler };
}

const recording: Screen = {
  kind: 'recording',
  browser: BRAVE_CHOICE,
  warnings: [],
  name: 'Demo',
  startedAtMs: 1000,
  events: [],
  pendingDialog: null,
  promptText: { value: '', cursor: 0 },
  isConfirmingDiscard: false,
  isStopping: false,
};
const menu: Screen = { kind: 'main-menu', selected: 0 };
const library: Screen = {
  kind: 'library',
  entries: [],
  cursor: { selected: 0, top: 0 },
  mode: { kind: 'browse' },
  error: null,
};

describe('src/tui/application/frame-scheduler.ts', () => {
  it('draws nothing until something changes', () => {
    const { timers, draw } = setup(menu);
    timers.flushDeferred();
    expect(draw).not.toHaveBeenCalled();
  });

  it('coalesces every change of one tick into a single draw', () => {
    const { timers, store, draw } = setup(menu);
    store.dispatch({ type: 'move-selection', delta: 1 });
    store.dispatch({ type: 'move-selection', delta: 1 });
    store.dispatch({ type: 'move-selection', delta: -1 });
    expect(draw).not.toHaveBeenCalled();
    timers.flushDeferred();
    expect(draw).toHaveBeenCalledTimes(1);
    store.dispatch({ type: 'move-selection', delta: 1 });
    timers.flushDeferred();
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('draws on request, for the first frame', () => {
    const { timers, scheduler, draw } = setup(menu);
    scheduler.requestDraw();
    scheduler.requestDraw();
    timers.flushDeferred();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('ticks every 250 ms while recording so the clock and new events show up', () => {
    const { clock, timers, store, draw } = setup(recording);
    clock.advance(250);
    timers.flushDeferred();
    expect(store.getState().nowMs).toBe(1250);
    expect(draw).toHaveBeenCalledTimes(1);
    clock.advance(250);
    timers.flushDeferred();
    expect(store.getState().nowMs).toBe(1500);
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('ticks while a replay runs and while the setup spins', () => {
    const replay: Screen = {
      kind: 'replay',
      browser: BRAVE_CHOICE,
      warnings: [],
      name: 'n',
      events: [],
      startedAtMs: 0,
      view: { status: 'running', steps: [], errorMessage: null },
    };
    for (const screen of [replay, initialState().screen]) {
      const { clock, timers, store } = setup(screen);
      clock.advance(250);
      timers.flushDeferred();
      expect(store.getState().nowMs).toBe(1250);
    }
  });

  it('stays quiet on screens that do not animate', () => {
    const { clock, timers, store, draw } = setup(menu);
    clock.advance(1000);
    timers.flushDeferred();
    expect(store.getState().nowMs).toBe(1000);
    expect(draw).not.toHaveBeenCalled();
  });

  it('refreshes the library every 2 seconds while it is on screen', () => {
    const { clock, refreshLibrary } = setup(library);
    clock.advance(1999);
    expect(refreshLibrary).not.toHaveBeenCalled();
    clock.advance(1);
    expect(refreshLibrary).toHaveBeenCalledTimes(1);
    clock.advance(2000);
    expect(refreshLibrary).toHaveBeenCalledTimes(2);
  });

  it('does not refresh the library from other screens', () => {
    const { clock, refreshLibrary } = setup(recording);
    clock.advance(6000);
    expect(refreshLibrary).not.toHaveBeenCalled();
  });

  it('stops everything on stop', () => {
    const { clock, timers, store, draw, refreshLibrary, scheduler } =
      setup(library);
    scheduler.stop();
    clock.advance(10_000);
    store.dispatch({ type: 'move-selection', delta: 1 });
    timers.flushDeferred();
    expect(refreshLibrary).not.toHaveBeenCalled();
    expect(draw).not.toHaveBeenCalled();
  });
});
