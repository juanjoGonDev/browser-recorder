import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { scriptPrelude } from '../../../src/script-generation/domain/script-prelude.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';
import { runNodeModule } from '../../support/run-node-module.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const SCRATCH_PARENT = path.join(ROOT, 'recordings');
const LOOPBACK = '127.0.0.1';

/** The prelude's runtime driving a real headless Chromium, one scenario each. */
function program(scenario: string): string {
  return `import { chromium } from 'patchright';
${scriptPrelude}
const browser = await chromium.launch({ headless: true, args: ['--site-per-process'] });
const context = await browser.newContext();
const rt = createRuntime(context, { elementTimeoutMs: 400 });
const page = await context.newPage();
try {
${scenario}
} catch (error) {
  console.log('failed: ' + (error instanceof Error ? error.message : String(error)));
} finally {
  await browser.close();
}
`;
}

describe('rt.scrollTo in the generated runtime', () => {
  let outer: FixtureServer;
  let inner: FixtureServer;
  let scratch: string;

  beforeAll(async () => {
    outer = await startFixtureServer();
    inner = await startFixtureServer();
    mkdirSync(SCRATCH_PARENT, { recursive: true });
    scratch = mkdtempSync(path.join(SCRATCH_PARENT, 'scroll-runtime-'));
  });

  afterAll(async () => {
    await outer.close();
    await inner.close();
    rmSync(scratch, { recursive: true, force: true });
  });

  async function run(scenario: string): Promise<string[]> {
    const result = await runNodeModule(program(scenario), {
      directory: scratch,
      shouldCloseStdin: false,
    });
    return result.stdout.split('\n').filter((line) => line !== '');
  }

  it('scrolls an element inside a real cross-origin (out-of-process) iframe', async () => {
    const innerPage = inner
      .urlFor('scroll-replay-inner.html')
      .replace(LOOPBACK, 'localhost');
    const lines = await run(`
      await page.goto(${JSON.stringify(`${outer.urlFor('cross-origin-frame.html')}?inner=${encodeURIComponent(innerPage)}`)});
      const frame = await (await page.locator('iframe#inner').elementHandle()).contentFrame();
      await frame.waitForLoadState();
      let isOutOfProcess = true;
      try { await context.newCDPSession(frame); } catch { isOutOfProcess = false; }
      console.log('oopif ' + isOutOfProcess);
      await rt.scrollTo(page, [page.locator('iframe#inner'), page.frameLocator('iframe#inner').locator('#panel')], [0, 321]);
      console.log('top ' + await frame.evaluate(() => document.getElementById('panel').scrollTop));
    `);

    expect(lines).toStrictEqual(['oopif true', 'top 321']);
  });

  it('names the missing element instead of hanging', async () => {
    const lines = await run(`
      await page.goto(${JSON.stringify(outer.urlFor('scroll-replay.html'))});
      await rt.scrollTo(page, [page.locator('#nope')], [0, 5]);
    `);

    expect(lines[0]).toMatch(/^failed: /u);
    expect(lines.join('\n')).toContain('#nope');
  });

  describe('inside shadow trees', () => {
    const openBox = "page.locator('#box')";
    const deepBox = "page.locator('#deep')";

    async function shadowTop(scenario: string): Promise<string[]> {
      return run(`
        await page.goto(${JSON.stringify(outer.urlFor('scroll-shadow.html'))});
        ${scenario}
      `);
    }

    it('scrolls an element inside an open shadow root to the exact position', async () => {
      const lines = await shadowTop(`
        await rt.scrollTo(page, [${openBox}], [0, 333]);
        console.log('top ' + await page.locator('#box').evaluate((e) => e.scrollTop));
      `);

      expect(lines).toStrictEqual(['top 333']);
    });

    it('scrolls an element inside nested open shadow roots', async () => {
      const lines = await shadowTop(`
        await rt.scrollTo(page, [${deepBox}], [0, 217]);
        console.log('top ' + await page.locator('#deep').evaluate((e) => e.scrollTop));
        console.log('box ' + await page.locator('#box').evaluate((e) => e.scrollTop));
      `);

      expect(lines).toStrictEqual(['top 217', 'box 0']);
    });

    it('scrolls an element inside a shadow root of an iframe', async () => {
      const lines = await shadowTop(`
        await rt.scrollTo(page, [page.locator('iframe#inner'), page.frameLocator('iframe#inner').locator('#framed')], [0, 123]);
        const frame = await (await page.locator('iframe#inner').elementHandle()).contentFrame();
        console.log('top ' + await frame.locator('#framed').evaluate((e) => e.scrollTop));
      `);

      expect(lines).toStrictEqual(['top 123']);
    });

    it('scrolls a shadow root that was attached after the page loaded', async () => {
      const lines = await shadowTop(`
        await page.locator('#attach').click();
        await rt.scrollTo(page, [page.locator('#late')], [0, 88]);
        console.log('top ' + await page.locator('#late').evaluate((e) => e.scrollTop));
      `);

      expect(lines).toStrictEqual(['top 88']);
    });

    it('runs nothing in the main world', async () => {
      const lines = await shadowTop(`
        const inMainWorld = (read) => page.evaluate(read, undefined, undefined, false);
        const before = await inMainWorld(() => Object.getOwnPropertyNames(window).length);
        await rt.scrollTo(page, [${deepBox}], [0, 150]);
        const after = await inMainWorld(() => Object.getOwnPropertyNames(window).length);
        console.log('spy ' + await inMainWorld(() => window.spy.calls));
        console.log('globals ' + (after - before));
        console.log('own ' + await page.locator('#deep').evaluate((e) => Object.getOwnPropertyNames(e).length));
      `);

      expect(lines).toStrictEqual(['spy 0', 'globals 0', 'own 0']);
    });

    it('names the missing element inside a shadow tree instead of hanging', async () => {
      const lines = await shadowTop(`
        await rt.scrollTo(page, [page.locator('#not-in-the-shadow')], [0, 5]);
      `);

      expect(lines[0]).toMatch(/^failed: /u);
    });
  });

  it('scrolls the element that nth picks among several matches', async () => {
    const lines = await run(`
      await page.goto(${JSON.stringify(outer.urlFor('scroll-replay.html'))});
      await rt.scrollTo(page, [page.locator('#panel, #tall').nth(0)], [0, 60]);
      console.log('panel ' + await page.locator('#panel').evaluate((e) => e.scrollTop));
    `);

    expect(lines).toStrictEqual(['panel 60']);
  });
});
