import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll } from 'vitest';
import type { CaptureHarness } from './capture-harness.ts';
import { createCaptureHarness } from './capture-harness.ts';
import type { FixtureServer } from './fixture-server.ts';
import { startFixtureServer } from './fixture-server.ts';

export interface CaptureSite {
  /** Opens a fixture page in a fresh, instrumented browser context. */
  open(pageName: string): Promise<CaptureHarness>;
  /** Opens the page in a context with no recorder attached at all. */
  openPlain(pageName: string): Promise<Page>;
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
    async openPlain(pageName) {
      const page = await browser.newPage();
      await page.goto(server.urlFor(pageName));
      return page;
    },
    async open(pageName) {
      const harness = await createCaptureHarness(browser, server);
      open.push(harness);
      await harness.open(pageName);
      return harness;
    },
  };
}
