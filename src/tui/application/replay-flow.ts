import type { ReplayTiming } from '../../shared/domain/replay-timing.ts';
import type { LiveReplayView, ReplayView } from '../domain/app-views.ts';
import {
  messageOf,
  syncClock,
  type ControllerDeps,
} from './controller-deps.ts';

export interface ReplayFlow {
  start(slug: string, timing: ReplayTiming): Promise<void>;
  /** Asks the running script to stop; a no-op when nothing is running. */
  cancel(): Promise<void>;
}

const STARTING_VIEW: ReplayView = {
  status: 'running',
  steps: [],
  errorMessage: null,
  warnings: [],
};

export function createReplayFlow(deps: ControllerDeps): ReplayFlow {
  return new LiveReplayFlow(deps);
}

class LiveReplayFlow implements ReplayFlow {
  private live: LiveReplayView | null = null;

  private readonly deps: ControllerDeps;

  constructor(deps: ControllerDeps) {
    this.deps = deps;
  }

  async start(slug: string, timing: ReplayTiming): Promise<void> {
    const { store, services } = this.deps;
    try {
      const recording = await services.library.load(slug);
      const live = await services.replay.start(slug, timing);
      syncClock(this.deps);
      store.dispatch({
        type: 'replay-started',
        recording,
        view: STARTING_VIEW,
        warnings: live.warnings,
        timing,
      });
      this.live = live;
      live.subscribe((view) => {
        store.dispatch({ type: 'replay-updated', view });
      });
      void this.watchFinish(live);
    } catch (error) {
      store.dispatch({ type: 'library-error', message: messageOf(error) });
    }
  }

  async cancel(): Promise<void> {
    await this.live?.cancel();
  }

  private async watchFinish(live: LiveReplayView): Promise<void> {
    const { store } = this.deps;
    try {
      store.dispatch({ type: 'replay-updated', view: await live.finished });
    } catch (error) {
      store.dispatch({
        type: 'replay-updated',
        view: {
          ...STARTING_VIEW,
          status: 'failed',
          errorMessage: messageOf(error),
        },
      });
    }
    if (this.live === live) this.live = null;
  }
}
