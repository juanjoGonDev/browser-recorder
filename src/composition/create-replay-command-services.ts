import type {
  ReplayCommandServices,
  ReplayRun,
  RunView,
} from '../cli/application/ports/replay-command-services.ts';
import type { ReplayProgress } from '../replay/domain/replay-progress.ts';
import type { LibraryService } from '../script-library/application/library-service.ts';
import type { BrowserInstallation } from '../environment-setup/application/ports/browser-installation.ts';
import type { LaunchPlanner } from './browser-launch-plan.ts';
import {
  launchReplay,
  type LaunchedReplay,
  type ReplayDeps,
} from './launch-replay.ts';

export interface ReplayCommandServicesDeps {
  readonly library: Pick<LibraryService, 'list' | 'regenerateScript'>;
  readonly planner: Pick<LaunchPlanner, 'forReplay'>;
  readonly installation: Pick<BrowserInstallation, 'isInstalled'>;
  readonly replay: ReplayDeps;
  /** A monotonic clock in milliseconds. */
  readonly now: () => number;
}

/** The slice of a replay snapshot the command line prints. */
function toRunView(progress: ReplayProgress): RunView {
  return {
    status: progress.status,
    steps: progress.steps.map(({ index, status, elapsedMs }) => ({
      index,
      status,
      elapsedMs,
    })),
    lastStepIndex: progress.lastStepIndex,
    errorMessage: progress.errorMessage,
    stderrTail: progress.stderrTail,
  };
}

function toReplayRun(launched: LaunchedReplay): ReplayRun {
  const { recording, live } = launched;
  return {
    name: recording.name,
    events: recording.events,
    warnings: launched.warnings,
    subscribe: (listener) =>
      live.subscribe((progress) => {
        listener(toRunView(progress));
      }),
    cancel: () => live.cancel(),
    finished: live.finished.then(toRunView),
    released: launched.released,
  };
}

/** The command line's view of the same launch path the TUI uses. */
export function createReplayCommandServices(
  deps: ReplayCommandServicesDeps,
): ReplayCommandServices {
  const { library, planner, installation, replay } = deps;
  return {
    listRecordings: async () =>
      (await library.list()).map((listing) =>
        listing.kind === 'valid'
          ? { slug: listing.summary.slug, name: listing.summary.name }
          : { slug: listing.slug, name: null },
      ),
    startReplay: async (slug, options) =>
      toReplayRun(
        await launchReplay(
          { library, planner, installation, replay },
          slug,
          options,
        ),
      ),
    now: deps.now,
  };
}
