import type { LiveReplay } from '../replay/application/replay-runner.ts';
import type { ReplayProgress } from '../replay/domain/replay-progress.ts';
import type { LiveReplayView, ReplayView } from '../tui/domain/app-views.ts';

/** What the TUI shows of a replay snapshot: status, per-step drift, error. */
export function toReplayView(progress: ReplayProgress): ReplayView {
  return {
    status: progress.status,
    steps: progress.steps.map(({ index, status, driftMs }) => ({
      index,
      status,
      driftMs,
    })),
    errorMessage: progress.errorMessage,
  };
}

export function toLiveReplayView(replay: LiveReplay): LiveReplayView {
  return {
    warnings: [],
    subscribe: (listener) =>
      replay.subscribe((progress) => {
        listener(toReplayView(progress));
      }),
    cancel: () => replay.cancel(),
    finished: replay.finished.then(toReplayView),
  };
}
