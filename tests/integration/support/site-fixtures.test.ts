import type { Page } from 'patchright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { FixtureServer } from '../../support/fixture-server.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';
import { launchPersistent } from '../../support/persistent-context.ts';
import type { PersistentBrowser } from '../../support/persistent-context.ts';

/** Long enough that a report merely sent when a click returns is late. */
const SLOW_REPORT_MS = 300;

describe('tests/fixtures/site', () => {
  let server: FixtureServer;
  let slow: FixtureServer;
  let browser: PersistentBrowser;
  let page: Page;

  beforeAll(async () => {
    server = await startFixtureServer();
    slow = await startFixtureServer({ reportDelayMs: SLOW_REPORT_MS });
    browser = await launchPersistent();
    page = browser.context.pages()[0] ?? (await browser.context.newPage());
  });

  afterAll(async () => {
    await browser.dispose();
    await server.close();
    await slow.close();
  });

  async function innerSourceFor(inner: string): Promise<string | null> {
    const query = `?inner=${encodeURIComponent(inner)}`;
    await page.goto(server.urlFor(`cross-origin-frame.html${query}`));
    return page.locator('iframe#inner').getAttribute('src');
  }

  // A replay closes the browser as soon as its last step returns: a report
  // still in flight then would never reach the server.
  describe.each([
    ['typing.html', /^click\|\d+\|$/u],
    ['roundtrip.html', /^\|\|sent$/u],
  ])('%s', (fixture, clickReport) => {
    it('has reported a click by the time the click returns', async () => {
      await page.goto(slow.urlFor(fixture));
      slow.clearReports();
      await page.getByRole('button', { name: 'Send' }).click();
      expect(slow.reports()).toEqual([expect.stringMatching(clickReport)]);
    });
  });

  describe('cross-origin-frame.html', () => {
    it.each([
      ['http://localhost:4100/iframe-inner.html'],
      ['http://127.0.0.1:4100/scroll-shadow-inner.html'],
    ])('frames the loopback page %s', async (inner) => {
      expect(await innerSourceFor(inner)).toBe(inner);
    });

    it.each([
      ['javascript:alert(1)'],
      ['data:text/html,<p>x</p>'],
      ['https://example.com/'],
      ['http://localhost.example.com/'],
      ['//example.com/'],
      ['not a url'],
    ])('frames nothing for %s', async (inner) => {
      expect(await innerSourceFor(inner)).toBeNull();
    });
  });
});
