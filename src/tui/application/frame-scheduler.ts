import type { AppState } from '../domain/app-state.ts';
import type { AppStore } from './app-store.ts';
import type { Timers } from './ports/timers.ts';

export interface FrameScheduler {
  /** Asks for a frame; any number of requests in a tick draw once. */
  requestDraw(): void;
  stop(): void;
}

export interface FrameSchedulerDeps {
  readonly timers: Timers;
  readonly store: AppStore;
  readonly draw: () => void;
  readonly refreshLibrary: () => void;
}

/** Recording and replay clocks and the setup spinner need a steady redraw. */
const TICK_INTERVAL_MS = 250;
/** Recordings can change on disk behind the app, so the list is re-read. */
const LIBRARY_REFRESH_MS = 2000;

function isAnimated(state: AppState): boolean {
  const { kind } = state.screen;
  return kind === 'recording' || kind === 'replay' || kind === 'setup';
}

/**
 * Renders when state changes (coalesced into one draw per tick) and keeps the
 * live screens fresh with a timer, so the app refreshes itself.
 */
export function createFrameScheduler(deps: FrameSchedulerDeps): FrameScheduler {
  const { timers, store } = deps;
  let isDrawPending = false;
  let isStopped = false;

  function requestDraw(): void {
    if (isDrawPending || isStopped) return;
    isDrawPending = true;
    timers.defer(() => {
      isDrawPending = false;
      if (!isStopped) deps.draw();
    });
  }

  const unsubscribe = store.subscribe(requestDraw);
  const cancelTick = timers.every(TICK_INTERVAL_MS, () => {
    if (isAnimated(store.getState())) {
      store.dispatch({ type: 'tick', nowMs: timers.now() });
    }
  });
  const cancelRefresh = timers.every(LIBRARY_REFRESH_MS, () => {
    if (store.getState().screen.kind === 'library') deps.refreshLibrary();
  });

  return {
    requestDraw,
    stop() {
      isStopped = true;
      unsubscribe();
      cancelTick();
      cancelRefresh();
    },
  };
}
