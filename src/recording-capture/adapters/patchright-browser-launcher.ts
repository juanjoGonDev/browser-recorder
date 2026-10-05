import { chromium } from 'patchright';
import type { BrowserContext, BrowserType } from 'patchright';
import type {
  BrowserLauncher,
  BrowserSession,
  LaunchOptions,
} from '../application/ports/browser-launcher.ts';
import type { MonotonicClock } from '../application/ports/monotonic-clock.ts';
import { buildLaunchSettings } from '../domain/launch-arguments.ts';
import {
  ProfileLockedAtLaunchError,
  isProfileInUseError,
} from '../domain/is-profile-in-use-error.ts';
import { startPatchrightSession } from './patchright-browser-session.ts';

/** A browser that hangs on start must not leave the recorder waiting forever. */
const LAUNCH_TIMEOUT_MS = 30_000;

export type PersistentLauncher = BrowserType['launchPersistentContext'];

export interface PatchrightLauncherDeps {
  readonly clock: MonotonicClock;
  readonly inPageScriptPath: string;
  /** The engine's launcher; replaced only by tests that inspect the options. */
  readonly launchPersistentContext?: PersistentLauncher;
}

async function openContext(
  launch: PersistentLauncher,
  options: LaunchOptions,
): Promise<BrowserContext> {
  const settings = buildLaunchSettings(options.display, options.target);
  try {
    return await launch(options.target.userDataDir, {
      headless: options.isHeadless,
      viewport: settings.viewport,
      args: [...settings.args],
      timeout: LAUNCH_TIMEOUT_MS,
      ...(settings.executablePath === undefined
        ? {}
        : { executablePath: settings.executablePath }),
      ...(settings.ignoreDefaultArgs === undefined
        ? {}
        : { ignoreDefaultArgs: [...settings.ignoreDefaultArgs] }),
    });
  } catch (error) {
    throw isProfileInUseError(error)
      ? new ProfileLockedAtLaunchError(error)
      : error;
  }
}

/**
 * Launches the browser of a recording on a persistent profile directory with
 * no custom user agent, headers or channel: nothing that tells the page it is
 * automated is added by the recorder itself.
 */
export function createPatchrightBrowserLauncher(
  deps: PatchrightLauncherDeps,
): BrowserLauncher {
  const launch: PersistentLauncher =
    deps.launchPersistentContext ??
    chromium.launchPersistentContext.bind(chromium);
  return {
    async launch(options: LaunchOptions): Promise<BrowserSession> {
      const context = await openContext(launch, options);
      try {
        return await startPatchrightSession({
          context,
          clock: deps.clock,
          inPageScriptPath: deps.inPageScriptPath,
          startUrl: options.startUrl,
        });
      } catch (error) {
        await context.close();
        throw error;
      }
    },
  };
}
