import { chromium } from 'patchright';
import type { Browser, CDPSession, Page } from 'patchright';
import type { FixtureServer } from './fixture-server.ts';
import { startFixtureServer } from './fixture-server.ts';

export interface BindingCall {
  readonly name: string;
  readonly payload: string;
  readonly executionContextId: number;
}

export interface CdpProbe {
  readonly page: Page;
  readonly cdp: CDPSession;
  readonly server: FixtureServer;
  /** Every CDP method this probe's own session sent, in order. */
  readonly sent: readonly string[];
  /** Every `Runtime.bindingCalled` this probe's own session received. */
  readonly bindingCalls: readonly BindingCall[];
  /** The context id of a named isolated world in a frame (idempotent). */
  worldOf(frameId: string, worldName: string): Promise<number>;
  /** The main frame id and the ids of its direct child frames. */
  frameIds(): Promise<{ main: string; children: readonly string[] }>;
  close(): Promise<void>;
}

interface FrameTree {
  readonly frame: { readonly id: string };
  readonly childFrames?: readonly FrameTree[];
}

function spyOnSends(cdp: CDPSession): string[] {
  const sent: string[] = [];
  const send = cdp.send.bind(cdp) as (
    method: string,
    params?: object,
  ) => Promise<unknown>;
  (cdp as { send: typeof send }).send = (method, params) => {
    sent.push(method);
    return send(method, params);
  };
  return sent;
}

async function openSession(
  browser: Browser,
): Promise<{ page: Page; cdp: CDPSession }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  return { page, cdp };
}

/**
 * A headless Patchright page with one raw CDP session of our own. The probe
 * never sends the two forbidden `enable` methods, which is the point of the
 * spike: it observes what Chromium does without them.
 */
export async function openCdpProbe(): Promise<CdpProbe> {
  const server = await startFixtureServer();
  const browser = await chromium.launch({ headless: true });
  const { page, cdp } = await openSession(browser);
  const sent = spyOnSends(cdp);
  const bindingCalls: BindingCall[] = [];
  cdp.on('Runtime.bindingCalled', (event: BindingCall) => {
    bindingCalls.push(event);
  });
  await cdp.send('Page.enable');
  return {
    page,
    cdp,
    server,
    sent,
    bindingCalls,
    async worldOf(frameId, worldName) {
      const result = await cdp.send('Page.createIsolatedWorld', {
        frameId,
        worldName,
      });
      return result.executionContextId;
    },
    async frameIds() {
      const { frameTree } = (await cdp.send('Page.getFrameTree')) as {
        frameTree: FrameTree;
      };
      return {
        main: frameTree.frame.id,
        children: (frameTree.childFrames ?? []).map((child) => child.frame.id),
      };
    },
    async close() {
      await browser.close();
      await server.close();
    },
  };
}
