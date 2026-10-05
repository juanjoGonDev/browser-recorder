import { chromium } from 'patchright';
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

/**
 * Launches a fresh ephemeral Chromium profile. The target and the display kind
 * are not honoured yet: the persistent-context launcher replaces this one.
 */
export function createPlaywrightBrowserLauncher(
  deps: PlaywrightLauncherDeps,
): BrowserLauncher {
  return {
    async launch(options: LaunchOptions): Promise<BrowserSession> {
      const browser = await chromium.launch({ headless: options.isHeadless });
      try {
        const context = await browser.newContext({
          viewport: {
            width: options.display.width,
            height: options.display.height,
          },
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
