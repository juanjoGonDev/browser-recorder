import type { Browser, BrowserContext, Page } from 'playwright';
import { vi } from 'vitest';
import {
  BINDING_NAME,
  parseInPageMessage,
} from '../../src/recording-capture/domain/in-page-message.ts';
import type { InPageMessage } from '../../src/recording-capture/domain/in-page-message.ts';
import type { Locator } from '../../src/shared/domain/locator.ts';
import type { CapturedEvent } from '../../src/recording-capture/domain/captured-event.ts';
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
  /** Every well formed message the in-page script sent, in arrival order. */
  readonly received: ReceivedMessage[];
  /** Messages the binding got that failed validation. */
  readonly rejectedCount: () => number;
  open(pageName: string): Promise<void>;
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
 * A browser context wired the way the Playwright adapter wires one: the
 * bundled capture script is injected into every document and the binding
 * collects what it emits. Tests then drive trusted input and assert on it.
 */
export async function createCaptureHarness(
  browser: Browser,
  server: FixtureServer,
): Promise<CaptureHarness> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const received: ReceivedMessage[] = [];
  let rejected = 0;
  await context.exposeBinding(BINDING_NAME, (source, raw: unknown) => {
    const message = parseInPageMessage(raw);
    if (message === null) {
      rejected += 1;
      return;
    }
    received.push({
      message,
      frameUrl: source.frame.url(),
      isMainFrame: source.frame === source.page.mainFrame(),
    });
  });
  await context.addInitScript({ path: IN_PAGE_BUNDLE_PATH });
  const page = await context.newPage();
  const domMessages = (kind?: string): ReceivedMessage[] =>
    received.filter(
      ({ message }) =>
        message.kind === 'dom' &&
        (kind === undefined || message.payload.kind === kind),
    );
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
    received,
    rejectedCount: () => rejected,
    async open(pageName) {
      await page.goto(server.urlFor(pageName));
    },
    domMessages,
    firstDom(kind) {
      const found = domMessages(kind).at(0);
      if (found?.message.kind !== 'dom') {
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
      return domMessages(kind).flatMap(({ message }) =>
        message.kind === 'dom' ? [message.payload] : [],
      );
    },
    close: () => context.close(),
  };
}
