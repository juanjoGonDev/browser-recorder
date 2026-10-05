import { chromium } from 'playwright';
import type {
  BrowserLauncher,
  BrowserSession,
  LaunchOptions,
} from '../application/ports/browser-launcher.ts';
import type { MonotonicClock } from '../application/ports/monotonic-clock.ts';
import { startPlaywrightSession } from './playwright-browser-session.ts';

export interface PlaywrightLauncherDeps {
  readonly clock: MonotonicClock;
  readonly inPageScriptPath: string;
}

/** Launches a fresh ephemeral Chromium profile with a fixed viewport. */
export function createPlaywrightBrowserLauncher(
  deps: PlaywrightLauncherDeps,
): BrowserLauncher {
  return {
    async launch(options: LaunchOptions): Promise<BrowserSession> {
      const browser = await chromium.launch({ headless: options.isHeadless });
      try {
        const context = await browser.newContext({
          viewport: options.viewport,
        });
        return await startPlaywrightSession({
          browser,
          context,
          clock: deps.clock,
          inPageScriptPath: deps.inPageScriptPath,
          startUrl: options.startUrl,
        });
      } catch (error) {
        await browser.close();
        throw error;
      }
    },
  };
}
