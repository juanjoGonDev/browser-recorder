import { chromium } from 'patchright';
import type { Browser } from 'patchright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IN_PAGE_BUNDLE_PATH } from '../../support/build-in-page-bundle.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';

// Proves the local toolchain end to end: Chromium is installed, the fixture
// site is served, and the bundled in-page script can be injected.
describe('local Chromium with the fixture site', () => {
  let browser: Browser;
  let server: FixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer();
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
    await server.close();
  });

  it('drives a fixture page with real input', async () => {
    const page = await browser.newPage();
    await page.goto(server.urlFor('button.html'));
    await page.getByTestId('save-button').click();

    await expect(page.locator('#status').textContent()).resolves.toBe('saved');
    await page.close();
  });

  it('injects the bundled capture script into every document', async () => {
    const context = await browser.newContext();
    await context.addInitScript({ path: IN_PAGE_BUNDLE_PATH });
    const page = await context.newPage();
    await page.goto(server.urlFor('checkbox.html'));

    await page.getByLabel('Subscribe').check();
    await expect(page.locator('#state').textContent()).resolves.toBe('checked');
    await context.close();
  });
});
