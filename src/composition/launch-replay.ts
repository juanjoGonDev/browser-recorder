import type { BrowserInstallation } from '../environment-setup/application/ports/browser-installation.ts';
import { MANUAL_INSTALL_COMMAND } from '../environment-setup/application/ensure-browser.ts';
import type { ProcessSpawner } from '../replay/application/ports/process-spawner.ts';
import { startReplay } from '../replay/application/replay-runner.ts';
import type { LiveReplay } from '../replay/application/replay-runner.ts';
import type { LibraryService } from '../script-library/application/library-service.ts';
import type { Recording } from '../shared/domain/recording.ts';
import type { ReplayTiming } from '../shared/domain/replay-timing.ts';
import type { LaunchPlan, LaunchPlanner } from './browser-launch-plan.ts';
import { toReplayEnvironment } from './browser-launch-plan.ts';

export interface ReplayDeps {
  readonly spawner: ProcessSpawner;
  readonly nodePath: string;
  readonly cancelGraceMs: number;
  /** The package root: the generated script resolves `patchright` from it. */
  readonly cwd: string;
  readonly scriptPathOf: (slug: string) => string;
  /** The parent environment; only the test seed is read from it. */
  readonly parentEnv?: Readonly<Record<string, string | undefined>>;
}

export interface ReplayLaunchDeps {
  readonly library: Pick<LibraryService, 'regenerateScript'>;
  readonly planner: Pick<LaunchPlanner, 'forReplay'>;
  readonly installation: Pick<BrowserInstallation, 'isInstalled'>;
  readonly replay: ReplayDeps;
}

export interface ReplayLaunchOptions {
  readonly timing: ReplayTiming;
  readonly isHeadless: boolean;
}

export interface LaunchedReplay {
  readonly recording: Recording;
  readonly live: LiveReplay;
  /** Cautions to show while the replay runs. */
  readonly warnings: readonly string[];
  /** Settles once the replay ended and its profile copy was deleted. */
  readonly released: Promise<void>;
}

/** Releasing is cleanup: it must never turn a good run into a failure. */
function releaseQuietly(plan: LaunchPlan): Promise<void> {
  return plan.release().catch(() => undefined);
}

const BUNDLED_MISSING = 'Chromium (bundled) is not installed on this machine.';

function withInstallCommand(reason: string, cause?: unknown): Error {
  return new Error(`${reason}\nInstall it with: ${MANUAL_INSTALL_COMMAND}`, {
    cause,
  });
}

/**
 * A missing Chromium is reported with the manual command: replaying never
 * installs a browser by itself. The catalog always lists the bundled browser,
 * so the plan succeeds even when it is absent: the target is checked here.
 */
async function planReplay(
  deps: ReplayLaunchDeps,
  recording: Recording,
): Promise<LaunchPlan> {
  let plan: LaunchPlan;
  try {
    plan = await deps.planner.forReplay(recording.browser);
  } catch (error) {
    if (await deps.installation.isInstalled()) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw withInstallCommand(reason, error);
  }
  const isBundled = plan.target.executablePath === null;
  if (isBundled && !(await deps.installation.isInstalled())) {
    await releaseQuietly(plan);
    throw withInstallCommand(BUNDLED_MISSING);
  }
  return plan;
}

/**
 * Regenerates the script, plans the browser and starts the replay: the one
 * launch path the TUI and the command line share.
 */
export async function launchReplay(
  deps: ReplayLaunchDeps,
  slug: string,
  options: ReplayLaunchOptions,
): Promise<LaunchedReplay> {
  const { replay } = deps;
  // A script written before Patchright imports a package that is gone.
  const recording = await deps.library.regenerateScript(slug);
  const plan = await planReplay(deps, recording);
  const live = startReplay(
    {
      spawner: replay.spawner,
      nodePath: replay.nodePath,
      cancelGraceMs: replay.cancelGraceMs,
      ...(replay.parentEnv === undefined
        ? {}
        : { parentEnv: replay.parentEnv }),
    },
    {
      scriptPath: replay.scriptPathOf(slug),
      cwd: replay.cwd,
      isHeadless: options.isHeadless,
      launchEnv: toReplayEnvironment(plan.target),
      timing: options.timing,
      stepOffsetsMs: recording.events.map((event) => event.offsetMs),
    },
  );
  const release = (): Promise<void> => releaseQuietly(plan);
  const released = live.finished.then(release, release);
  return { recording, live, warnings: plan.warnings, released };
}
