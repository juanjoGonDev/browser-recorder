import { chromium } from 'patchright';
import type { Browser, CDPSession, Frame } from 'patchright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FixtureServer } from '../support/fixture-server.ts';
import { startFixtureServer } from '../support/fixture-server.ts';

const WORLD = '__spike_world';
const BINDING = '__spike_binding';
const SETTLE_MS = 400;

function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, SETTLE_MS);
  });
}

interface BindingEvent {
  readonly payload: string;
  readonly executionContextId: number;
}

async function ownFrameId(cdp: CDPSession): Promise<string> {
  const { frameTree } = (await cdp.send('Page.getFrameTree')) as {
    frameTree: { frame: { id: string } };
  };
  return frameTree.frame.id;
}

describe('S0 spike: the isolated world of a cross-origin (out-of-process) frame', () => {
  let outer: FixtureServer;
  let inner: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    outer = await startFixtureServer();
    inner = await startFixtureServer();
    // `localhost` is another site than `127.0.0.1`, so the inner frame gets a
    // renderer process (and a CDP session) of its own.
    browser = await chromium.launch({
      headless: true,
      args: ['--site-per-process'],
    });
  });

  afterAll(async () => {
    await browser.close();
    await outer.close();
    await inner.close();
  });

  it('answers world lookups and binding calls on the frame session', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const innerUrl = inner
      .urlFor('iframe-inner.html')
      .replace('127.0.0.1', 'localhost');
    await page.goto(
      `${outer.urlFor('cross-origin-frame.html')}?inner=${encodeURIComponent(innerUrl)}`,
    );
    const frame: Frame | undefined = page
      .frames()
      .find((candidate) => candidate !== page.mainFrame());
    expect(page.frames()).toHaveLength(2);
    const cdp = await context.newCDPSession(frame as Frame);
    const calls: BindingEvent[] = [];
    cdp.on('Runtime.bindingCalled', (event: BindingEvent) => {
      calls.push(event);
    });
    await cdp.send('Page.enable');
    const frameId = await ownFrameId(cdp);

    const world = await cdp.send('Page.createIsolatedWorld', {
      frameId,
      worldName: WORLD,
    });
    await cdp.send('Runtime.addBinding', {
      name: BINDING,
      executionContextName: WORLD,
    });
    await cdp.send('Runtime.evaluate', {
      contextId: world.executionContextId,
      expression: `${BINDING}('from-oopif')`,
    });
    await settle();

    expect(calls).toEqual([
      {
        name: BINDING,
        payload: 'from-oopif',
        executionContextId: world.executionContextId,
      },
    ]);
  });
});
