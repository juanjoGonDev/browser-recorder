import { chromium } from 'patchright';
import type { BrowserContext, Frame, Page } from 'patchright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as GuardedCdp from '../../src/recording-capture/adapters/guarded-cdp.ts';
import { isForbiddenCdpMethod } from '../../src/recording-capture/adapters/guarded-cdp.ts';
import { createPatchrightBrowserLauncher } from '../../src/recording-capture/adapters/patchright-browser-launcher.ts';
import { createPerformanceClock } from '../../src/recording-capture/adapters/performance-clock.ts';
import type {
  BrowserSession,
  SessionSignal,
} from '../../src/recording-capture/application/ports/browser-launcher.ts';
import { IN_PAGE_BUNDLE_PATH } from '../support/build-in-page-bundle.ts';
import { traceSessions } from '../support/cdp-trace.ts';
import type { FixtureServer } from '../support/fixture-server.ts';
import { startFixtureServer } from '../support/fixture-server.ts';

/** Every method a session was asked to send, before the guard looked at it. */
const attempted = vi.hoisted((): string[] => []);

vi.mock(
  '../../src/recording-capture/adapters/guarded-cdp.ts',
  async (importOriginal) => {
    const original = await importOriginal<typeof GuardedCdp>();
    return {
      ...original,
      guardCdp: (session: Parameters<typeof original.guardCdp>[0]) => {
        const guarded = original.guardCdp(session);
        return new Proxy(guarded, {
          get(target, property, receiver): unknown {
            if (property !== 'send')
              return Reflect.get(target, property, receiver);
            return (method: string, params?: object): Promise<unknown> => {
              attempted.push(method);
              return (
                target as unknown as {
                  send(m: string, p?: object): Promise<unknown>;
                }
              ).send(method, params);
            };
          },
        });
      },
    };
  },
);

type DomSignal = Extract<SessionSignal, { kind: 'dom' }>;

const LOOPBACK = '127.0.0.1';
const WAIT = { timeout: 15_000, interval: 50 };
const SCENARIO_TIMEOUT_MS = 120_000;

function isClick(signal: SessionSignal): signal is DomSignal {
  return signal.kind === 'dom' && signal.payload.kind === 'click';
}

describe('CDP method audit of a recording session', () => {
  let outer: FixtureServer;
  let inner: FixtureServer;
  let profileDir: string;
  let context: BrowserContext;
  let session: BrowserSession;
  let page: Page;
  const signals: SessionSignal[] = [];
  let sent: string[] = [];
  let isCrossOriginFrameOutOfProcess = false;

  const clicks = (): DomSignal[] => signals.filter(isClick);

  /** Clicks a probe until the recorder reports a click: the page is captured. */
  async function waitUntilCaptured(probe: () => Promise<void>): Promise<void> {
    const known = clicks().length;
    await vi.waitFor(async () => {
      await probe();
      expect(clicks().length).toBeGreaterThan(known);
    }, WAIT);
  }

  const namedClicks = (name: string): number =>
    clicks().filter((signal) =>
      signal.candidates.some(
        (candidate) => candidate.kind === 'role' && candidate.name === name,
      ),
    ).length;

  /** Clicks, then waits until one more click on the named element is reported. */
  async function clickAndWaitForReport(
    name: string,
    click: () => Promise<void>,
  ): Promise<void> {
    const known = namedClicks(name);
    await click();
    await vi.waitFor(() => {
      expect(namedClicks(name)).toBeGreaterThan(known);
    }, WAIT);
  }

  async function isOutOfProcess(frame: Frame): Promise<boolean> {
    try {
      await context.newCDPSession(frame);
      return true;
    } catch {
      return false;
    }
  }

  async function recordSameOriginFrame(): Promise<void> {
    await page.goto(outer.urlFor('iframe.html'));
    await waitUntilCaptured(() => page.locator('#outer-status').click());
    await clickAndWaitForReport('Inner action', () =>
      page.frameLocator('#inner').getByRole('button').click(),
    );
  }

  async function recordCrossOriginFrame(): Promise<void> {
    const innerPage = inner
      .urlFor('iframe-inner.html')
      .replace(LOOPBACK, 'localhost');
    await page.goto(
      `${outer.urlFor('cross-origin-frame.html')}?inner=${encodeURIComponent(innerPage)}`,
    );
    await vi.waitFor(() => {
      expect(page.frames()).toHaveLength(2);
    }, WAIT);
    await waitUntilCaptured(() =>
      page.frameLocator('#inner').locator('#inner-status').click(),
    );
    isCrossOriginFrameOutOfProcess = await isOutOfProcess(page.frames()[1]);
    await clickAndWaitForReport('Inner action', () =>
      page.frameLocator('#inner').getByRole('button').click(),
    );
  }

  async function recordNavigationAndScroll(): Promise<void> {
    await page.goto(outer.urlFor('nav-a.html'));
    await waitUntilCaptured(() => page.locator('h1').click());
    await clickAndWaitForReport('Go to B', () => page.locator('#to-b').click());
    await page.goto(outer.urlFor('scroll.html'));
    await waitUntilCaptured(() => page.locator('#tall').click());
    await page.mouse.wheel(0, 600);
    await vi.waitFor(() => {
      expect(
        signals.some(
          (signal) => signal.kind === 'dom' && signal.payload.kind === 'scroll',
        ),
      ).toBe(true);
    }, WAIT);
  }

  async function recordDialog(): Promise<void> {
    await page.goto(outer.urlFor('prompt-hash.html'));
    await waitUntilCaptured(() => page.locator('body').click());
    void page.locator('#ask').click();
    await vi.waitFor(() => {
      expect(signals.some(({ kind }) => kind === 'dialog-opened')).toBe(true);
    }, WAIT);
    await session.respondToDialog({ action: 'accept', promptText: 'abc' });
    await vi.waitFor(() => {
      expect(page.url()).toMatch(/#name-abc$/);
    }, WAIT);
  }

  beforeAll(async () => {
    outer = await startFixtureServer();
    inner = await startFixtureServer();
    profileDir = await mkdtemp(join(tmpdir(), 'br-audit-'));
    const launcher = createPatchrightBrowserLauncher({
      clock: createPerformanceClock(),
      inPageScriptPath: IN_PAGE_BUNDLE_PATH,
      launchPersistentContext: async (dir, options) => {
        context = await chromium.launchPersistentContext(dir, options);
        sent = traceSessions(context);
        return context;
      },
    });
    session = await launcher.launch({
      startUrl: null,
      display: { kind: 'window', width: 1280, height: 800 },
      isHeadless: true,
      target: {
        executablePath: null,
        userDataDir: profileDir,
        // The headless shell does not isolate sites by default.
        browserArgs: ['--site-per-process'],
        shouldUseRealKeychain: false,
      },
    });
    session.onSignal((signal) => signals.push(signal));
    const first = context.pages().at(0);
    if (first === undefined) throw new Error('the session has no page');
    page = first;
    await recordSameOriginFrame();
    await recordCrossOriginFrame();
    await recordNavigationAndScroll();
    await recordDialog();
  }, SCENARIO_TIMEOUT_MS);

  afterAll(async () => {
    await session.close();
    await rm(profileDir, { recursive: true, force: true });
    await outer.close();
    await inner.close();
  });

  it('traces real capture traffic, so an empty trace cannot pass the audit', () => {
    expect(sent).toEqual(
      expect.arrayContaining([
        'Page.enable',
        'Page.createIsolatedWorld',
        'Runtime.addBinding',
        'Runtime.evaluate',
        'Page.getFrameTree',
      ]),
    );
    expect(attempted).toEqual(expect.arrayContaining(sent.slice(0, 1)));
  });

  it('never sends Runtime.enable or Console.enable, nor tries to', () => {
    expect(sent.filter(isForbiddenCdpMethod)).toEqual([]);
    expect(attempted.filter(isForbiddenCdpMethod)).toEqual([]);
  });

  it('sends no document-start script either', () => {
    expect(sent).not.toContain('Page.addScriptToEvaluateOnNewDocument');
  });

  it('really crossed a process boundary for the cross-origin frame', () => {
    expect(isCrossOriginFrameOutOfProcess).toBe(true);
  });

  it('stores the clicks of the page, of a same-origin frame and of a cross-origin frame', () => {
    const innerButtonPaths = clicks()
      .filter((signal) =>
        signal.candidates.some(
          (candidate) =>
            candidate.kind === 'role' && candidate.name === 'Inner action',
        ),
      )
      .map((signal) => signal.framePath);
    expect(innerButtonPaths).toEqual([['#inner'], ['#inner']]);
    expect(
      clicks().some(
        (signal) =>
          signal.framePath.length === 0 &&
          signal.candidates.some(
            (candidate) =>
              candidate.kind === 'css' &&
              candidate.selector === '#outer-status',
          ),
      ),
    ).toBe(true);
  });

  it('records the navigation, the dialog and the scroll too', () => {
    const kinds = new Set(signals.map(({ kind }) => kind));
    expect(kinds).toContain('navigation');
    expect(kinds).toContain('dialog-opened');
    expect(
      signals.some(
        (signal) => signal.kind === 'dom' && signal.payload.kind === 'scroll',
      ),
    ).toBe(true);
  });
});
