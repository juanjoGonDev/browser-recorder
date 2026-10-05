import { mkdtempSync, rmSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RECORDED_TIMING } from '../../../src/shared/domain/replay-timing.ts';
import { nodeProcessProbe } from '../../../src/browser-profiles/adapters/node-process-probe.ts';
import { nodeProfileFileSystem } from '../../../src/browser-profiles/adapters/node-profile-file-system.ts';
import { createProfileStore } from '../../../src/browser-profiles/application/profile-store.ts';
import { createProfileLayout } from '../../../src/browser-profiles/domain/profile-layout.ts';
import type { InstalledBrowser } from '../../../src/browser-selection/application/browser-catalog.ts';
import { createLaunchPlanner } from '../../../src/composition/browser-launch-plan.ts';
import { createBrowserViews } from '../../../src/composition/browser-views.ts';
import { createAppServices } from '../../../src/composition/create-app-services.ts';
import type { ComposedServices } from '../../../src/composition/create-app-services.ts';
import {
  createProductionDeps,
  resolveProductionPaths,
} from '../../../src/composition/create-production-services.ts';
import { createPatchrightBrowserLauncher } from '../../../src/recording-capture/adapters/patchright-browser-launcher.ts';
import { createPerformanceClock } from '../../../src/recording-capture/adapters/performance-clock.ts';
import type { SessionSignal } from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import type { BrowserChoice } from '../../../src/shared/domain/browser-choice.ts';
import { IN_PAGE_BUNDLE_PATH } from '../../support/build-in-page-bundle.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { BRAVE_LIKE_PROFILE } from '../../support/profile-fixtures.ts';
import {
  assertUnderFixtures,
  catalogOf,
  detectRealBrowser,
  isHeadedAllowed,
  isRealBrowserEnabled,
} from '../../support/real-browser.ts';
import { snapshotTree } from '../../support/tree-snapshot.ts';
import { createScratchDir } from '../../support/scratch-root.ts';

const WAIT = { timeout: 20_000, interval: 100 };
const WINDOW = { kind: 'window', width: 1280, height: 800 } as const;
const FIXTURE_PROFILE = 'Default';
const COPY: Omit<BrowserChoice, 'browserId'> = {
  profileMode: 'copy-of-real',
  sourceProfile: FIXTURE_PROFILE,
};
const MANAGED: Omit<BrowserChoice, 'browserId'> = {
  profileMode: 'managed',
  sourceProfile: null,
};

/**
 * Opt-in: `BROWSER_RECORDER_REAL_BROWSER_TESTS=1 pnpm test`. Launches the
 * detected real browser (headless unless `BROWSER_RECORDER_HEADED_TESTS=1`) on
 * copies of `tests/fixtures/profiles/brave-like` only. On macOS the real
 * keychain switches may make the OS ask for access to the browser's key.
 */
describe.runIf(isRealBrowserEnabled(process.env))(
  'real browser (opt-in)',
  () => {
    const isHeadless = !isHeadedAllowed(process.env);
    let site: FixtureServer;
    let appData: string;
    let scratch: string;
    let real: InstalledBrowser | null = null;
    let services: ComposedServices;
    let planner: ReturnType<typeof createLaunchPlanner>;

    function browser(): InstalledBrowser {
      if (real === null) {
        throw new Error('No real browser detected: set a path or install one.');
      }
      return real;
    }

    beforeAll(async () => {
      site = await startFixtureServer();
      scratch = createScratchDir('e2e-real-');
      appData = mkdtempSync(path.join(tmpdir(), 'br-real-app-data-'));
      real = await detectRealBrowser(process.env, BRAVE_LIKE_PROFILE);
      const catalog = catalogOf(browser());
      const platform = process.platform;
      const profiles = createProfileStore({
        fs: nodeProfileFileSystem,
        processes: nodeProcessProbe,
        platform,
        layout: createProfileLayout(platform, appData),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      });
      planner = createLaunchPlanner({ catalog, profiles });
      const deps = createProductionDeps({
        paths: {
          ...resolveProductionPaths(import.meta.url),
          recordingsRoot: scratch,
          inPageScriptPath: IN_PAGE_BUNDLE_PATH,
          appDataRoot: appData,
        },
        isHeadless,
      });
      services = createAppServices({
        ...deps,
        planner,
        browserViews: createBrowserViews({
          catalog,
          profiles,
          platform,
          isRunning: () => Promise.resolve(false),
        }),
      });
    });

    afterAll(async () => {
      await services.persistActiveRecording();
      await site.close();
      rmSync(scratch, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    });

    it('only ever copies from the fixture profile', () => {
      expect(assertUnderFixtures(browser().userDataDir ?? '')).toBe(
        BRAVE_LIKE_PROFILE,
      );
    });

    it('launches on a copy of the fixture, deletes the copy and leaves the fixture unchanged', async () => {
      const before = await snapshotTree(BRAVE_LIKE_PROFILE);
      const plan = await planner.forRecording({
        browserId: browser().browserId,
        ...COPY,
      });
      expect(plan.target.browserArgs).toEqual([
        `--profile-directory=${FIXTURE_PROFILE}`,
      ]);
      expect(plan.target.userDataDir.startsWith(appData)).toBe(true);
      const signals: SessionSignal[] = [];
      const session = await createPatchrightBrowserLauncher({
        clock: createPerformanceClock(),
        inPageScriptPath: IN_PAGE_BUNDLE_PATH,
      }).launch({
        startUrl: site.urlFor('button.html'),
        display: WINDOW,
        isHeadless,
        target: plan.target,
      });
      session.onSignal((signal) => signals.push(signal));
      await vi.waitFor(() => {
        expect(signals.some(({ kind }) => kind === 'navigation')).toBe(true);
      }, WAIT);
      await session.close();
      await plan.release();
      await expect(access(plan.target.userDataDir)).rejects.toThrow();
      expect(await snapshotTree(BRAVE_LIKE_PROFILE)).toEqual(before);
    });

    it('rejects a recording and a replay on a profile a running browser holds', async () => {
      const choice: BrowserChoice = {
        browserId: browser().browserId,
        ...MANAGED,
      };
      const first = await services.recording.start({
        name: 'Held profile',
        startUrl: site.urlFor('button.html'),
        browser: choice,
      });
      await vi.waitFor(async () => {
        const saved = await services.library.load('held-profile');
        expect(saved.events.length).toBeGreaterThan(0);
      }, WAIT);
      await first.stop();

      const holder = await services.recording.start({
        name: 'Holder',
        startUrl: null,
        browser: choice,
      });
      await expect(
        services.recording.start({
          name: 'Second on the same profile',
          startUrl: null,
          browser: choice,
        }),
      ).rejects.toThrow(/profile is in use/);
      await expect(
        services.replay.start('held-profile', RECORDED_TIMING),
      ).rejects.toThrow(/profile is in use/);
      await holder.stop();
    });

    it('records and replays on a copy of the fixture profile', async () => {
      const before = await snapshotTree(BRAVE_LIKE_PROFILE);
      const live = await services.recording.start({
        name: 'Copied profile',
        startUrl: site.urlFor('button.html'),
        browser: { browserId: browser().browserId, ...COPY },
      });
      await vi.waitFor(async () => {
        const saved = await services.library.load('copied-profile');
        expect(saved.events.length).toBeGreaterThan(0);
      }, WAIT);
      await live.stop();

      const replay = await services.replay.start(
        'copied-profile',
        RECORDED_TIMING,
      );
      const final = await replay.finished;
      expect(final.errorMessage).toBeNull();
      expect(final.status).toBe('succeeded');
      expect(await snapshotTree(BRAVE_LIKE_PROFILE)).toEqual(before);
    });
  },
);
