import { describe, expect, it } from 'vitest';

import { scriptPrelude } from '../../../src/script-generation/domain/script-prelude.ts';
import { runNodeModule } from '../../support/run-node-module.ts';

const QUIET_WINDOW_MS = 60;
const SETTLE_CAP_MS = 300;
const NAVIGATION_TIMEOUT_MS = 200;

const FAKES = String.raw`
import { EventEmitter } from 'node:events';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const context = new EventEmitter();
const rt = createRuntime(context, {
  navigationTimeoutMs: ${String(NAVIGATION_TIMEOUT_MS)},
  quietWindowMs: ${String(QUIET_WINDOW_MS)},
  settleCapMs: ${String(SETTLE_CAP_MS)},
  settlePollMs: 10,
});
const loadStates = [];
function fakePage(initialUrl) {
  const page = new EventEmitter();
  const main = { currentUrl: initialUrl, url() { return this.currentUrl; } };
  page.mainFrame = () => main;
  page.waitForLoadState = async (state) => { loadStates.push(state); };
  page.navigate = (url) => { main.currentUrl = url; page.emit('framenavigated', main); };
  page.navigateChildFrame = (url) => {
    page.emit('framenavigated', { url: () => url });
  };
  return page;
}
const request = (url) => ({ url: () => url });
const attempt = (promise) =>
  promise.then(() => 'resolved', (error) => error.message);
`;

function run(body: string) {
  return runNodeModule(`${scriptPrelude}\n${FAKES}\n${body}\n`);
}

async function outcome(body: string): Promise<string> {
  const result = await run(body);
  return result.stdout.trim();
}

const SITE = 'https://site.test/app';

describe('src/script-generation/domain/settle-prelude.ts navigation', () => {
  it('resolves for a reload of the same URL committed after the action', async () => {
    const text = await outcome(`
      const page = fakePage('${SITE}?tab=1');
      rt.start(); context.emit('page', page);
      await rt.at(0);
      setTimeout(() => page.navigate('${SITE}?tab=1'), 30);
      console.log(await attempt(rt.waitForNavigation(page, '${SITE}')));
      console.log(loadStates.join());`);
    expect(text).toBe('resolved\nload');
  });

  it('resolves for a navigation to another path and ignores other paths', async () => {
    const text = await outcome(`
      const page = fakePage('${SITE}');
      rt.start(); context.emit('page', page);
      await rt.at(0);
      setTimeout(() => page.navigate('https://site.test/elsewhere'), 20);
      setTimeout(() => page.navigate('https://site.test/next'), 50);
      console.log(await attempt(rt.waitForNavigation(page, 'https://site.test/next')));`);
    expect(text).toBe('resolved');
  });

  it('never lets a navigation older than the action satisfy the wait', async () => {
    const text = await outcome(`
      const page = fakePage('${SITE}');
      rt.start(); context.emit('page', page);
      page.navigate('${SITE}');
      await rt.at(0); rt.mark(4);
      console.log(await attempt(rt.waitForNavigation(page, '${SITE}')));`);
    expect(text).toBe(
      'Timed out waiting for the navigation of step 4 to ' + SITE,
    );
  });

  it('does not miss a navigation that commits right after the action', async () => {
    const text = await outcome(`
      const page = fakePage('${SITE}');
      rt.start(); context.emit('page', page);
      await rt.at(0);
      page.navigate('${SITE}');
      await sleep(40);
      console.log(await attempt(rt.waitForNavigation(page, '${SITE}')));`);
    expect(text).toBe('resolved');
  });

  it('consumes a navigation so a second wait needs a new one', async () => {
    const text = await outcome(`
      const page = fakePage('${SITE}');
      rt.start(); context.emit('page', page);
      await rt.at(0);
      page.navigate('${SITE}');
      console.log(await attempt(rt.waitForNavigation(page, '${SITE}')));
      rt.mark(9);
      console.log(await attempt(rt.waitForNavigation(page, '${SITE}')));`);
    expect(text).toBe(
      'resolved\nTimed out waiting for the navigation of step 9 to ' + SITE,
    );
  });

  it('re-arms on each action but not on a follow-up', async () => {
    const text = await outcome(`
      const page = fakePage('${SITE}');
      rt.start(); context.emit('page', page);
      await rt.at(0);
      page.navigate('${SITE}');
      await rt.at(0, { isFollowUp: true });
      console.log(await attempt(rt.waitForNavigation(page, '${SITE}')));
      await rt.at(0);
      console.log(await attempt(rt.waitForNavigation(page, '${SITE}')));`);
    expect(text.split('\n')[0]).toBe('resolved');
    expect(text.split('\n')[1]).toContain('Timed out');
  });

  it('ignores navigations of child frames', async () => {
    const text = await outcome(`
      const page = fakePage('${SITE}');
      rt.start(); context.emit('page', page);
      await rt.at(0);
      page.navigateChildFrame('${SITE}');
      console.log(await attempt(rt.waitForNavigation(page, '${SITE}')));`);
    expect(text).toContain('Timed out waiting for the navigation');
  });

  it('tracks the pages that already exist when the script starts', async () => {
    const text = await outcome(`
      const page = fakePage('${SITE}');
      context.pages = () => [page];
      rt.start();
      await rt.at(0);
      page.navigate('${SITE}');
      console.log(await attempt(rt.waitForNavigation(page, '${SITE}')));`);
    expect(text).toBe('resolved');
  });
});

describe('src/script-generation/domain/settle-prelude.ts settle', () => {
  it('waits one quiet window when nothing is in flight', async () => {
    const text = await outcome(`
      rt.start();
      const before = performance.now();
      const result = await rt.settle();
      console.log(JSON.stringify({ result, took: performance.now() - before }));`);
    const { result, took } = JSON.parse(text) as {
      result: unknown;
      took: number;
    };
    expect(result).toStrictEqual({ isQuiet: true, pendingCount: 0 });
    expect(took).toBeGreaterThanOrEqual(QUIET_WINDOW_MS);
    expect(took).toBeLessThan(SETTLE_CAP_MS);
  });

  it('waits for a pending request plus the quiet window', async () => {
    const text = await outcome(`
      rt.start();
      const pending = request('https://site.test/api');
      context.emit('request', pending);
      setTimeout(() => context.emit('requestfinished', pending), 120);
      const before = performance.now();
      const result = await rt.settle();
      console.log(JSON.stringify({ result, took: performance.now() - before }));`);
    const { result, took } = JSON.parse(text) as {
      result: unknown;
      took: number;
    };
    expect(result).toStrictEqual({ isQuiet: true, pendingCount: 0 });
    expect(took).toBeGreaterThanOrEqual(120 + QUIET_WINDOW_MS);
    expect(took).toBeLessThan(SETTLE_CAP_MS);
  });

  it('counts a failed request as finished', async () => {
    const text = await outcome(`
      rt.start();
      const pending = request('https://site.test/api');
      context.emit('request', pending);
      setTimeout(() => context.emit('requestfailed', pending), 50);
      console.log(JSON.stringify(await rt.settle()));`);
    expect(JSON.parse(text)).toStrictEqual({ isQuiet: true, pendingCount: 0 });
  });

  it('stops at the cap with a count-only warning when a request never ends', async () => {
    const result = await run(`
      rt.start();
      context.emit('request', request('https://site.test/secret?token=abc'));
      const before = performance.now();
      const outcomeOfSettle = await rt.settle();
      console.log('took ' + Math.round(performance.now() - before));
      console.log(JSON.stringify(outcomeOfSettle));`);
    const lines = result.stdout.trim().split('\n');
    const tookMs = Number(lines[1].replace('took ', ''));
    expect(lines[0]).toBe(
      '::warn "Stopped waiting for the network after 0.3 s; 1 request was still in flight"',
    );
    expect(tookMs).toBeGreaterThanOrEqual(SETTLE_CAP_MS);
    expect(tookMs).toBeLessThan(SETTLE_CAP_MS + 150);
    expect(JSON.parse(lines[2])).toStrictEqual({
      isQuiet: false,
      pendingCount: 1,
    });
    expect(result.stdout).not.toContain('token');
  });

  it('pluralizes the count of requests still in flight', async () => {
    const result = await run(`
      rt.start();
      context.emit('request', request('https://site.test/a'));
      context.emit('request', request('https://site.test/b'));
      await rt.settle();`);
    expect(result.stdout).toContain('2 requests were still in flight');
  });

  it('ignores data and blob requests', async () => {
    const text = await outcome(`
      rt.start();
      context.emit('request', request('data:text/plain,hello'));
      context.emit('request', request('blob:https://site.test/1234'));
      console.log(JSON.stringify(await rt.settle()));`);
    expect(JSON.parse(text)).toStrictEqual({ isQuiet: true, pendingCount: 0 });
  });

  it('counts requests of every page of the context, popups included', async () => {
    const text = await outcome(`
      rt.start();
      const popup = fakePage('https://popup.test/');
      context.emit('page', popup);
      context.emit('request', request('https://popup.test/poll'));
      console.log(JSON.stringify(await rt.settle()));`);
    expect(JSON.parse(text.split('\n').at(-1) ?? '')).toStrictEqual({
      isQuiet: false,
      pendingCount: 1,
    });
  });

  it('does not wait for websockets', async () => {
    const result = await run(`
      rt.start();
      context.emit('websocket', { url: () => 'wss://site.test/socket' });
      console.log(JSON.stringify(await rt.settle()));`);
    expect(result.stdout.trim()).toBe('{"isQuiet":true,"pendingCount":0}');
  });
});
