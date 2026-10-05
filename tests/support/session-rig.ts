import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, vi } from 'vitest';
import { startPlaywrightSession } from '../../src/recording-capture/adapters/playwright-browser-session.ts';
import type {
  BrowserSession,
  SessionSignal,
} from '../../src/recording-capture/application/ports/browser-launcher.ts';
import { IN_PAGE_BUNDLE_PATH } from './build-in-page-bundle.ts';
import type { FakeClock } from './fake-clock.ts';
import { createFakeClock } from './fake-clock.ts';
import type { FixtureServer } from './fixture-server.ts';
import { startFixtureServer } from './fixture-server.ts';

export interface SessionRig {
  readonly session: BrowserSession;
  readonly context: BrowserContext;
  readonly browser: Browser;
  readonly clock: FakeClock;
  readonly signals: SessionSignal[];
  /** The first page the session opened. */
  firstPage(): Page;
  urlFor(pageName: string): string;
  /** Waits until a signal of the kind (and optional page) has arrived. */
  waitForSignal(
    kind: SessionSignal['kind'],
    count?: number,
  ): Promise<SessionSignal>;
  signalsOfKind(kind: SessionSignal['kind']): SessionSignal[];
}

export interface SessionRigFactory {
  /** Starts a session on a fresh headless browser, subscribed from the start. */
  start(startUrl: string | null): Promise<SessionRig>;
  /** Like `start`, but subscribes only after the page has finished loading. */
  startAndSubscribeLate(startUrl: string): Promise<SessionRig>;
}

/** A fixture server and a headless Chromium shared by one test file. */
export function useSessionRig(): SessionRigFactory {
  let server: FixtureServer;
  const browsers: Browser[] = [];

  beforeAll(async () => {
    server = await startFixtureServer();
  });

  afterAll(async () => {
    await Promise.all(browsers.map((browser) => browser.close()));
    await server.close();
  });

  async function build(
    startUrl: string | null,
    isSubscribedFirst: boolean,
  ): Promise<SessionRig> {
    const browser = await chromium.launch();
    browsers.push(browser);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const clock = createFakeClock(1000);
    const signals: SessionSignal[] = [];
    const session = await startPlaywrightSession({
      browser,
      context,
      clock,
      inPageScriptPath: IN_PAGE_BUNDLE_PATH,
      startUrl: startUrl === null ? null : server.urlFor(startUrl),
    });
    const waitForSignal: SessionRig['waitForSignal'] = async (
      kind,
      count = 1,
    ) => {
      await vi.waitFor(
        () => {
          if (signals.filter((signal) => signal.kind === kind).length < count) {
            throw new Error(`waiting for ${String(count)} ${kind} signal(s)`);
          }
        },
        { timeout: 4000, interval: 25 },
      );
      const found = signals
        .filter((signal) => signal.kind === kind)
        .at(count - 1);
      if (found === undefined) throw new Error(`no ${kind} signal`);
      return found;
    };
    const rig: SessionRig = {
      session,
      context,
      browser,
      clock,
      signals,
      firstPage: () => {
        const page = context.pages().at(0);
        if (page === undefined) throw new Error('no page');
        return page;
      },
      urlFor: (pageName) => server.urlFor(pageName),
      waitForSignal,
      signalsOfKind: (kind) => signals.filter((signal) => signal.kind === kind),
    };
    if (isSubscribedFirst) session.onSignal((signal) => signals.push(signal));
    return rig;
  }

  return {
    start: (startUrl) => build(startUrl, true),
    async startAndSubscribeLate(startUrl) {
      const rig = await build(startUrl, false);
      await rig.firstPage().waitForLoadState('load');
      await rig.firstPage().waitForTimeout(300);
      rig.session.onSignal((signal) => rig.signals.push(signal));
      return rig;
    },
  };
}
