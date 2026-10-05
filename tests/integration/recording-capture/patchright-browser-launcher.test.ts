import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPatchrightBrowserLauncher } from '../../../src/recording-capture/adapters/patchright-browser-launcher.ts';
import type { PersistentLauncher } from '../../../src/recording-capture/adapters/patchright-browser-launcher.ts';
import { createPerformanceClock } from '../../../src/recording-capture/adapters/performance-clock.ts';
import type {
  LaunchOptions,
  SessionSignal,
} from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import { ProfileLockedAtLaunchError } from '../../../src/recording-capture/domain/is-profile-in-use-error.ts';
import {
  BRAVE_TARGET,
  WINDOW_DISPLAY,
} from '../../support/browser-fixtures.ts';
import { IN_PAGE_BUNDLE_PATH } from '../../support/build-in-page-bundle.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';
import { removeDir } from '../../support/remove-dir.ts';

const LAUNCH_TIMEOUT_MS = 30_000;

describe('src/recording-capture/adapters/patchright-browser-launcher.ts', () => {
  let server: FixtureServer;
  const profileDirs: string[] = [];
  const launcher = createPatchrightBrowserLauncher({
    clock: createPerformanceClock(),
    inPageScriptPath: IN_PAGE_BUNDLE_PATH,
  });

  async function headlessOptions(
    overrides: Partial<LaunchOptions> = {},
  ): Promise<LaunchOptions> {
    const userDataDir = await mkdtemp(join(tmpdir(), 'br-launcher-'));
    profileDirs.push(userDataDir);
    return {
      startUrl: null,
      display: { kind: 'emulated', width: 800, height: 600 },
      isHeadless: true,
      target: {
        executablePath: null,
        userDataDir,
        browserArgs: [],
        shouldUseRealKeychain: false,
      },
      ...overrides,
    };
  }

  beforeAll(async () => {
    server = await startFixtureServer();
  });
  afterAll(async () => {
    await server.close();
    await Promise.all(profileDirs.map((dir) => removeDir(dir)));
  });

  describe('with the bundled browser, headless', () => {
    it('launches on the start url and reports its navigation', async () => {
      const session = await launcher.launch(
        await headlessOptions({ startUrl: server.urlFor('nav-a.html') }),
      );
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
      const session = await launcher.launch(await headlessOptions());
      const signals: SessionSignal[] = [];
      session.onSignal((signal) => signals.push(signal));
      await session.close();
      expect(signals).toHaveLength(0);
    });

    it('launches a real window size without emulated metrics', async () => {
      const session = await launcher.launch(
        await headlessOptions({
          display: WINDOW_DISPLAY,
          startUrl: server.urlFor('nav-a.html'),
        }),
      );
      await expect(session.close()).resolves.toBeUndefined();
    });

    it('survives an unreachable start url', async () => {
      const session = await launcher.launch(
        await headlessOptions({ startUrl: 'http://127.0.0.1:1/' }),
      );
      await expect(session.close()).resolves.toBeUndefined();
    });

    it('closes the browser it started when the session cannot be set up', async () => {
      const broken = createPatchrightBrowserLauncher({
        clock: createPerformanceClock(),
        inPageScriptPath: '/nonexistent/capture-script.js',
      });
      const options = await headlessOptions();
      await expect(broken.launch(options)).rejects.toThrow(/ENOENT/);
      // The profile directory is free again: the same one launches fine.
      const session = await launcher.launch(options);
      await expect(session.close()).resolves.toBeUndefined();
    });
  });

  describe('what the engine receives', () => {
    const stop = new Error('stop after the options are known');

    async function optionsSentFor(launch: LaunchOptions) {
      const sent: { dir: string; options: Record<string, unknown> }[] = [];
      const persistent: PersistentLauncher = (dir, options) => {
        sent.push({ dir, options: { ...options } });
        return Promise.reject(stop);
      };
      const fake = createPatchrightBrowserLauncher({
        clock: createPerformanceClock(),
        inPageScriptPath: IN_PAGE_BUNDLE_PATH,
        launchPersistentContext: persistent,
      });
      await expect(fake.launch(launch)).rejects.toBe(stop);
      return sent.at(0);
    }

    it("launches the stored browser's executable on the managed directory with a real window", async () => {
      const launch: LaunchOptions = {
        startUrl: null,
        display: WINDOW_DISPLAY,
        isHeadless: false,
        target: BRAVE_TARGET,
      };
      const sent = await optionsSentFor(launch);
      expect(sent?.dir).toBe('/fixture/app-data/profiles/brave/managed');
      expect(sent?.options).toEqual({
        headless: launch.isHeadless,
        executablePath: '/fixture/Brave Browser',
        viewport: null,
        args: ['--window-size=1280,800'],
        timeout: LAUNCH_TIMEOUT_MS,
      });
    });

    it('lets a copy of a real profile reach the real keychain', async () => {
      const sent = await optionsSentFor({
        startUrl: null,
        display: { kind: 'emulated', width: 640, height: 480 },
        isHeadless: true,
        target: {
          ...BRAVE_TARGET,
          browserArgs: ['--profile-directory=Default'],
          shouldUseRealKeychain: true,
        },
      });
      expect(sent?.options).toMatchObject({
        headless: true,
        viewport: { width: 640, height: 480 },
        args: ['--profile-directory=Default'],
        ignoreDefaultArgs: ['--use-mock-keychain', '--password-store=basic'],
      });
    });

    it('reports a profile held by another browser as a lock error', async () => {
      const cause = new Error('Opening in existing browser session.');
      const fake = createPatchrightBrowserLauncher({
        clock: createPerformanceClock(),
        inPageScriptPath: IN_PAGE_BUNDLE_PATH,
        launchPersistentContext: () => Promise.reject(cause),
      });
      const failure = await fake
        .launch({
          startUrl: null,
          display: WINDOW_DISPLAY,
          isHeadless: true,
          target: BRAVE_TARGET,
        })
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ProfileLockedAtLaunchError);
      expect((failure as Error).cause).toBe(cause);
    });
  });
});
