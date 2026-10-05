import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPlaywrightBrowserLauncher } from '../../../src/recording-capture/adapters/playwright-browser-launcher.ts';
import { createPerformanceClock } from '../../../src/recording-capture/adapters/performance-clock.ts';
import type { SessionSignal } from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import { IN_PAGE_BUNDLE_PATH } from '../../support/build-in-page-bundle.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';

describe('src/recording-capture/adapters/playwright-browser-launcher.ts', () => {
  let server: FixtureServer;
  const launcher = createPlaywrightBrowserLauncher({
    clock: createPerformanceClock(),
    inPageScriptPath: IN_PAGE_BUNDLE_PATH,
  });

  beforeAll(async () => {
    server = await startFixtureServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it('launches headless on the start url and reports its navigation', async () => {
    const session = await launcher.launch({
      startUrl: server.urlFor('nav-a.html'),
      viewport: { width: 1280, height: 800 },
      isHeadless: true,
    });
    const signals: SessionSignal[] = [];
    session.onSignal((signal) => signals.push(signal));
    await vi.waitFor(
      () => {
        if (signals.length === 0) throw new Error('no navigation yet');
      },
      { timeout: 5000 },
    );
    await session.close();
    expect(signals.map(({ kind }) => kind)).toEqual(['navigation']);
    expect(signals[0]).toMatchObject({ navigationType: 'navigate' });
  });

  it('launches with no start url and reports nothing', async () => {
    const session = await launcher.launch({
      startUrl: null,
      viewport: { width: 800, height: 600 },
      isHeadless: true,
    });
    const signals: SessionSignal[] = [];
    session.onSignal((signal) => signals.push(signal));
    await session.close();
    expect(signals).toHaveLength(0);
  });

  it('survives an unreachable start url', async () => {
    const session = await launcher.launch({
      startUrl: 'http://127.0.0.1:1/',
      viewport: { width: 800, height: 600 },
      isHeadless: true,
    });
    await expect(session.close()).resolves.toBeUndefined();
  });

  it('closes the browser it started when the session cannot be set up', async () => {
    const broken = createPlaywrightBrowserLauncher({
      clock: createPerformanceClock(),
      inPageScriptPath: '/nonexistent/capture-script.js',
    });
    await expect(
      broken.launch({
        startUrl: null,
        viewport: { width: 800, height: 600 },
        isHeadless: true,
      }),
    ).rejects.toThrow(/ENOENT/);
  });
});
