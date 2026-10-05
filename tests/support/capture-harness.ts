import type { Browser, BrowserContext, CDPSession, Page } from 'patchright';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { attachCapture } from '../../src/recording-capture/adapters/isolated-world-capture.ts';
import { createPerformanceClock } from '../../src/recording-capture/adapters/performance-clock.ts';
import type { InPageMessage } from '../../src/recording-capture/domain/in-page-message.ts';
import type { CaptureWorld } from '../../src/recording-capture/application/ports/capture-world.ts';
import type { Locator } from '../../src/shared/domain/locator.ts';
import type { CapturedEvent } from '../../src/recording-capture/domain/captured-event.ts';
import { INSTALL_FLAG_KEY } from '../../src/recording-capture/domain/in-page-message.ts';
import { IN_PAGE_BUNDLE_PATH } from './build-in-page-bundle.ts';
import type { FixtureServer } from './fixture-server.ts';

export interface ReceivedMessage {
  readonly message: InPageMessage;
  readonly frameUrl: string;
  readonly isMainFrame: boolean;
}

export interface DomMessage {
  readonly payload: CapturedEvent;
  readonly candidates: readonly Locator[];
  readonly isMainFrame: boolean;
  readonly frameUrl: string;
}

export interface CaptureHarness {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly cdp: CDPSession;
  readonly world: CaptureWorld;
  /** Every well formed message the in-page script sent, in arrival order. */
  readonly received: ReceivedMessage[];
  open(pageName: string): Promise<void>;
  /** Injects the capture script into the main frame's world a second time. */
  injectAgain(): Promise<void>;
  /** The dom messages whose payload has the given kind. */
  domMessages(kind?: string): ReceivedMessage[];
  /** The first dom message of the kind; fails the test when there is none. */
  firstDom(kind: string): DomMessage;
  /** Waits until at least `count` dom messages of the kind have arrived. */
  waitForDom(kind: string, count?: number): Promise<void>;
  /** Waits until the condition holds, polling every 25 ms for 3 s. */
  waitFor(condition: () => boolean): Promise<void>;
  /** The payloads of the dom messages, in arrival order. */
  payloads(kind?: string): CapturedEvent[];
  close(): Promise<void>;
}

/**
 * A browser context wired the way the Playwright adapter wires a page: the
 * bundled capture script runs in a CDP isolated world and reports through its
 * binding. Tests then drive trusted input and assert on what was reported.
 */
export async function createCaptureHarness(
  browser: Browser,
  server: FixtureServer,
): Promise<CaptureHarness> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const frameUrls = new Map<string, string>();
  await cdp.send('Page.enable');
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const mainFrameId = frameTree.frame.id;
  cdp.on(
    'Page.frameNavigated',
    (event: { frame: { id: string; url: string } }) => {
      frameUrls.set(event.frame.id, event.frame.url);
    },
  );
  const received: ReceivedMessage[] = [];
  const scriptSource = readFileSync(IN_PAGE_BUNDLE_PATH, 'utf8');
  const world = await attachCapture(cdp, {
    scriptSource,
    clock: createPerformanceClock(),
    onMessage: ({ message, frameId }) => {
      received.push({
        message,
        frameUrl: frameUrls.get(frameId) ?? '',
        isMainFrame: frameId === mainFrameId,
      });
    },
  });
  const domMessages = (kind?: string): ReceivedMessage[] =>
    received.filter(
      ({ message }) => kind === undefined || message.payload.kind === kind,
    );
  const isInstalledInMainFrame = async (): Promise<boolean> => {
    const contextId = await world.contextOf(mainFrameId);
    if (contextId === undefined) return false;
    const { result } = await cdp.send('Runtime.evaluate', {
      contextId,
      expression: `Symbol.for('${INSTALL_FLAG_KEY}') in window`,
      returnByValue: true,
    });
    return result.value === true;
  };
  const waitFor = (condition: () => boolean): Promise<void> =>
    vi.waitFor(
      () => {
        if (!condition()) throw new Error('condition not met yet');
      },
      { timeout: 3000, interval: 25 },
    );
  return {
    context,
    page,
    cdp,
    world,
    received,
    async open(pageName) {
      await page.goto(server.urlFor(pageName));
      // The script is put into a document right after it commits, so a test
      // that acts at once would outrun it; a person never does.
      await vi.waitFor(
        async () => {
          if (!(await isInstalledInMainFrame()))
            throw new Error('the capture script is not installed yet');
        },
        { timeout: 3000, interval: 25 },
      );
    },
    async injectAgain() {
      const contextId = await world.contextOf(mainFrameId);
      await cdp.send('Runtime.evaluate', {
        contextId,
        expression: scriptSource,
      });
    },
    domMessages,
    firstDom(kind) {
      const found = domMessages(kind).at(0);
      if (found === undefined) {
        throw new Error(`no ${kind} message was captured`);
      }
      const { payload, candidates } = found.message;
      return {
        payload,
        candidates,
        isMainFrame: found.isMainFrame,
        frameUrl: found.frameUrl,
      };
    },
    waitFor,
    waitForDom: (kind, count = 1) =>
      waitFor(() => domMessages(kind).length >= count),
    payloads(kind) {
      return domMessages(kind).map(({ message }) => message.payload);
    },
    close: () => context.close(),
  };
}
