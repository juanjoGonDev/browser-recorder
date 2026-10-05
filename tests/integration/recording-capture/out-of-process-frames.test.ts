import { chromium } from 'playwright';
import type { Browser, BrowserContext, Frame, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPerformanceClock } from '../../../src/recording-capture/adapters/performance-clock.ts';
import { startPlaywrightSession } from '../../../src/recording-capture/adapters/playwright-browser-session.ts';
import type { SessionSignal } from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import { IN_PAGE_BUNDLE_PATH } from '../../support/build-in-page-bundle.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';

type DomSignal = Extract<SessionSignal, { kind: 'dom' }>;

const LOOPBACK = '127.0.0.1';
const WAIT = { timeout: 8000, interval: 25 };

function isClick(signal: SessionSignal): signal is DomSignal {
  return signal.kind === 'dom' && signal.payload.kind === 'click';
}

function isOuter(signal: DomSignal): boolean {
  return signal.framePath.length === 0;
}

/** Clicks on a button: what the tests do, apart from the readiness probes. */
function domClicks(signals: readonly SessionSignal[]): DomSignal[] {
  return signals
    .filter(isClick)
    .filter((signal) =>
      signal.candidates.some(
        (candidate) => candidate.kind === 'role' && candidate.role === 'button',
      ),
    );
}

/**
 * The capture is installed asynchronously once a frame exists; a person never
 * outpaces it, a test can. Probes the inner frame until a click is reported.
 */
async function waitUntilCaptured(
  page: Page,
  signals: readonly SessionSignal[],
): Promise<void> {
  const known = signals.filter(isClick).length;
  await vi.waitFor(async () => {
    await page.frameLocator('#inner').locator('#inner-status').click();
    expect(signals.filter(isClick).length).toBeGreaterThan(known);
  }, WAIT);
}

async function isOutOfProcess(
  context: BrowserContext,
  frame: Frame,
): Promise<boolean> {
  try {
    await context.newCDPSession(frame);
    return true;
  } catch {
    return false;
  }
}

describe('cross-origin iframes (out-of-process frames)', () => {
  let outer: FixtureServer;
  let inner: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    outer = await startFixtureServer();
    inner = await startFixtureServer();
    // The headless shell does not isolate sites by default; the inner server
    // is reached as `localhost`, another site than the outer `127.0.0.1`, so
    // its frames get a renderer process of their own, as in a real browser.
    browser = await chromium.launch({ args: ['--site-per-process'] });
  });

  afterAll(async () => {
    await browser.close();
    await outer.close();
    await inner.close();
  });

  async function open(): Promise<{
    page: Page;
    signals: SessionSignal[];
    context: BrowserContext;
  }> {
    const context = await browser.newContext();
    const innerPage = inner
      .urlFor('iframe-inner.html')
      .replace(LOOPBACK, 'localhost');
    const session = await startPlaywrightSession({
      browser,
      context,
      clock: createPerformanceClock(),
      inPageScriptPath: IN_PAGE_BUNDLE_PATH,
      startUrl: `${outer.urlFor('cross-origin-frame.html')}?inner=${encodeURIComponent(innerPage)}`,
    });
    const signals: SessionSignal[] = [];
    session.onSignal((signal) => signals.push(signal));
    const [page] = context.pages();
    await vi.waitFor(() => {
      expect(page.frames()).toHaveLength(2);
    }, WAIT);
    await waitUntilCaptured(page, signals);
    return { page, signals, context };
  }

  it('is really an out-of-process frame, so the test cannot pass by accident', async () => {
    const { page, context } = await open();
    const [, frame] = page.frames();
    await expect(isOutOfProcess(context, frame)).resolves.toBe(true);
  });

  it('captures a click inside a cross-origin iframe with its frame path', async () => {
    const { page, signals } = await open();
    await page.frameLocator('#inner').getByRole('button').click();
    await vi.waitFor(() => {
      expect(domClicks(signals)).toHaveLength(1);
    }, WAIT);
    expect(domClicks(signals)[0]).toMatchObject({
      framePath: ['#inner'],
      pageId: 'page1',
    });
    expect(domClicks(signals)[0]?.candidates).toContainEqual({
      kind: 'role',
      role: 'button',
      name: 'Inner action',
    });
  });

  it('keeps capturing after the outer page reloads and the frame is recreated', async () => {
    const { page, signals } = await open();
    await page.reload();
    await vi.waitFor(() => {
      expect(page.frames()).toHaveLength(2);
    }, WAIT);
    await waitUntilCaptured(page, signals);
    await page.frameLocator('#inner').getByRole('button').click();
    await vi.waitFor(() => {
      expect(domClicks(signals)).toHaveLength(1);
    }, WAIT);
    expect(domClicks(signals)[0]?.framePath).toEqual(['#inner']);
  });

  it('names every iframe on the way to a frame nested inside the cross-origin one', async () => {
    const { page, signals } = await open();
    const [, outOfProcess] = page.frames();
    await outOfProcess.evaluate(
      (src) => {
        const nested = document.createElement('iframe');
        nested.id = 'deeper';
        nested.src = src;
        document.body.append(nested);
      },
      inner.urlFor('iframe-inner.html').replace(LOOPBACK, 'localhost'),
    );
    const deeper = page.frameLocator('#inner').frameLocator('#deeper');
    await deeper.getByRole('button').click();
    await vi.waitFor(() => {
      expect(domClicks(signals)).toHaveLength(1);
    }, WAIT);
    expect(domClicks(signals)[0]?.framePath).toEqual(['#inner', '#deeper']);
  });

  it('captures again after the frame moves to another site', async () => {
    const { page, signals } = await open();
    const [, outOfProcess] = page.frames();
    const elsewhere = outer.urlFor('iframe-inner.html');
    await outOfProcess.evaluate((href) => {
      location.href = href;
    }, elsewhere);
    await vi.waitFor(() => {
      expect(page.frames()[1]?.url()).toBe(elsewhere);
    }, WAIT);
    await waitUntilCaptured(page, signals);
    await page.frameLocator('#inner').getByRole('button').click();
    await vi.waitFor(() => {
      expect(domClicks(signals)).toHaveLength(1);
    }, WAIT);
    expect(domClicks(signals)[0]?.framePath).toEqual(['#inner']);
  });

  it('still captures clicks in the outer page', async () => {
    const { page, signals } = await open();
    await page.locator('#outer-status').click();
    await vi.waitFor(() => {
      expect(signals.filter(isClick).filter(isOuter)).toHaveLength(1);
    }, WAIT);
  });
});
