import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { afterAll, beforeAll } from 'vitest';
import type { CaptureHarness } from './capture-harness.ts';
import { createCaptureHarness } from './capture-harness.ts';
import type { FixtureServer } from './fixture-server.ts';
import { startFixtureServer } from './fixture-server.ts';

export interface CaptureSite {
  /** Opens a fixture page in a fresh, instrumented browser context. */
  open(pageName: string): Promise<CaptureHarness>;
}

/**
 * Starts a fixture server and one Chromium for a test file, and closes every
 * context a test opened. Call it inside a `describe`.
 */
export function useCaptureSite(): CaptureSite {
  let browser: Browser;
  let server: FixtureServer;
  const open: CaptureHarness[] = [];

  beforeAll(async () => {
    server = await startFixtureServer();
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await Promise.all(open.map((harness) => harness.close()));
    await browser.close();
    await server.close();
  });

  return {
    async open(pageName) {
      const harness = await createCaptureHarness(browser, server);
      open.push(harness);
      await harness.open(pageName);
      return harness;
    },
  };
}
