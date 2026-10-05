import type { BrowserCatalog } from '../browser-selection/application/browser-catalog.ts';
import { resolveReplayBrowser } from '../browser-selection/domain/resolve-replay-browser.ts';
import type { ProfileStore } from '../browser-profiles/application/profile-store.ts';
import type { LaunchTarget } from '../recording-capture/application/ports/browser-launcher.ts';
import type { BrowserChoice } from '../shared/domain/browser-choice.ts';
import { browserLabelOf } from './browser-labels.ts';
import {
  describeProfileWarning,
  explainProfileFailure,
} from './profile-messages.ts';

/** What one recording or replay launches, and how to clean up afterwards. */
export interface LaunchPlan {
  readonly choice: BrowserChoice;
  readonly target: LaunchTarget;
  /** Cautions to show while the browser runs. */
  readonly warnings: readonly string[];
  /** Deletes what the profile owns; safe to call more than once. */
  release(): Promise<void>;
}

export interface LaunchPlanner {
  /** Never fails because the browser is gone: it falls back and warns. */
  forRecording(choice: BrowserChoice): Promise<LaunchPlan>;
  /** Same fallback, worded for a replay. */
  forReplay(recorded: BrowserChoice): Promise<LaunchPlan>;
}

export interface LaunchPlannerDeps {
  readonly catalog: BrowserCatalog;
  readonly profiles: ProfileStore;
}

function once(action: () => Promise<void>): () => Promise<void> {
  let done: Promise<void> | null = null;
  return () => {
    done ??= action();
    return done;
  };
}

async function plan(
  deps: LaunchPlannerDeps,
  choice: BrowserChoice,
  leadingWarnings: readonly string[],
): Promise<LaunchPlan> {
  const installed = await deps.catalog.find(choice.browserId);
  if (installed === null) {
    throw new Error(
      `${browserLabelOf(choice.browserId)} is not installed on this machine.`,
    );
  }
  let prepared;
  try {
    prepared = await deps.profiles.prepare({
      browserId: choice.browserId,
      profileMode: choice.profileMode,
      sourceProfile: choice.sourceProfile,
      realUserDataDir: installed.userDataDir,
    });
  } catch (error) {
    throw explainProfileFailure(error, choice.browserId);
  }
  return {
    choice,
    target: {
      executablePath: installed.executablePath,
      userDataDir: prepared.userDataDir,
      browserArgs: prepared.browserArgs,
      shouldUseRealKeychain: prepared.shouldUseRealKeychain,
    },
    warnings: [
      ...leadingWarnings,
      ...prepared.warnings.map((warning) =>
        describeProfileWarning(warning, choice.browserId),
      ),
    ],
    release: once(() => prepared.release()),
  };
}

/** Resolves the choice against what is installed, warning when it falls back. */
async function planWithFallback(
  deps: LaunchPlannerDeps,
  chosen: BrowserChoice,
  action: 'recording' | 'replaying',
): Promise<LaunchPlan> {
  const available = new Set(
    (await deps.catalog.list()).map((browser) => browser.browserId),
  );
  const resolved = resolveReplayBrowser(chosen, (id) => available.has(id));
  if (resolved.kind === 'as-recorded') {
    return plan(deps, resolved.choice, []);
  }
  const cleanNote =
    chosen.profileMode === 'copy-of-real' ? ' with a clean profile' : '';
  return plan(deps, resolved.choice, [
    `${browserLabelOf(resolved.missing)} is not installed here: ${action} on the bundled Chromium instead${cleanNote}.`,
  ]);
}

/** Turns a browser choice into a launch target by combining both features. */
export function createLaunchPlanner(deps: LaunchPlannerDeps): LaunchPlanner {
  return {
    forRecording: (choice) => planWithFallback(deps, choice, 'recording'),
    forReplay: (recorded) => planWithFallback(deps, recorded, 'replaying'),
  };
}

const EXECUTABLE_PATH_VARIABLE = 'BROWSER_RECORDER_EXECUTABLE_PATH';
const USER_DATA_DIR_VARIABLE = 'BROWSER_RECORDER_USER_DATA_DIR';
const BROWSER_ARGS_VARIABLE = 'BROWSER_RECORDER_BROWSER_ARGS';
const REAL_KEYCHAIN_VARIABLE = 'BROWSER_RECORDER_REAL_KEYCHAIN';
const REAL_KEYCHAIN_ON = '1';

/**
 * The environment the generated script reads its browser from. All four
 * variables are always present: an empty value means "unset" and overrides
 * whatever the parent process inherited.
 */
export function toReplayEnvironment(
  target: LaunchTarget,
): Readonly<Record<string, string>> {
  return {
    [EXECUTABLE_PATH_VARIABLE]: target.executablePath ?? '',
    [USER_DATA_DIR_VARIABLE]: target.userDataDir,
    [BROWSER_ARGS_VARIABLE]: JSON.stringify(target.browserArgs),
    [REAL_KEYCHAIN_VARIABLE]: target.shouldUseRealKeychain
      ? REAL_KEYCHAIN_ON
      : '',
  };
}
