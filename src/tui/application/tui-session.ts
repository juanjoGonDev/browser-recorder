import { listRowsFor } from '../domain/viewport.ts';
import { createAppStore, type AppStore } from './app-store.ts';
import {
  createFrameScheduler,
  type FrameScheduler,
} from './frame-scheduler.ts';
import type { AppServices } from './ports/app-services.ts';
import type { Terminal } from './ports/terminal.ts';
import type { Timers } from './ports/timers.ts';
import { createTuiController, type TuiController } from './tui-controller.ts';
import type { AppState } from '../domain/app-state.ts';

/**
 * Turns the state and the terminal size into the bytes of one frame. Injected
 * because rendering lives in `render/`, which application code never imports.
 */
export type RenderFrame = (
  state: AppState,
  size: { readonly columns: number; readonly rows: number },
) => string;

export interface TuiSessionDeps {
  readonly services: AppServices;
  readonly terminal: Terminal;
  readonly timers: Timers;
  readonly renderFrame: RenderFrame;
}

function createScheduler(
  deps: TuiSessionDeps,
  store: AppStore,
  controller: TuiController,
): FrameScheduler {
  return createFrameScheduler({
    timers: deps.timers,
    store,
    draw: () => {
      deps.terminal.write(
        deps.renderFrame(store.getState(), deps.terminal.size()),
      );
    },
    refreshLibrary: () => {
      void controller.refreshLibrary();
    },
  });
}

function whenQuitting(store: AppStore): Promise<void> {
  return new Promise<void>((resolve) => {
    store.subscribe(() => {
      if (store.getState().isQuitting) resolve();
    });
  });
}

function syncSize(store: AppStore, terminal: Terminal): void {
  store.dispatch({
    type: 'resize',
    listRows: listRowsFor(terminal.size().rows),
  });
}

/**
 * Runs the whole app on `terminal` and resolves after the user quits, with
 * the terminal already restored (also when something throws).
 */
export async function runTui(deps: TuiSessionDeps): Promise<void> {
  const { terminal } = deps;
  const store = createAppStore();
  const controller = createTuiController({
    services: deps.services,
    store,
    timers: deps.timers,
  });
  const scheduler = createScheduler(deps, store, controller);
  const isDone = whenQuitting(store);
  terminal.enter();
  try {
    terminal.onKey((key) => {
      void controller.handleKey(key);
    });
    terminal.onResize(() => {
      syncSize(store, terminal);
      scheduler.requestDraw();
    });
    syncSize(store, terminal);
    scheduler.requestDraw();
    void controller.start();
    await isDone;
  } finally {
    scheduler.stop();
    terminal.restore();
  }
}
