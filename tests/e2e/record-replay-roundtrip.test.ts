import type { BrowserContext, Page } from 'patchright';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RECORDED_TIMING } from '../../src/shared/domain/replay-timing.ts';
import { createAppServices } from '../../src/composition/create-app-services.ts';
import type { ComposedServices } from '../../src/composition/create-app-services.ts';
import {
  createProductionDeps,
  resolveProductionPaths,
} from '../../src/composition/create-production-services.ts';
import { createPerformanceClock } from '../../src/recording-capture/adapters/performance-clock.ts';
import { startPatchrightSession } from '../../src/recording-capture/adapters/patchright-browser-session.ts';
import type { BrowserLauncher } from '../../src/recording-capture/application/ports/browser-launcher.ts';
import type {
  LiveRecordingView,
  ReplayView,
} from '../../src/tui/domain/app-views.ts';
import { BUNDLED_CHOICE } from '../support/browser-fixtures.ts';
import { IN_PAGE_BUNDLE_PATH } from '../support/build-in-page-bundle.ts';
import type { FixtureServer } from '../support/fixture-server.ts';
import { startFixtureServer } from '../support/fixture-server.ts';
import { launchPersistent } from '../support/persistent-context.ts';
import type { PersistentBrowser } from '../support/persistent-context.ts';
import { createScratchDir } from '../support/scratch-root.ts';
import { removeDirSync } from '../support/remove-dir.ts';

/** Design: every replayed step starts within this of its recorded offset. */
const DRIFT_TOLERANCE_MS = 100;
/**
 * Gaps between the user's actions: long enough that no step is late. A cold
 * persistent-context page load on a Windows runner was measured near 1 s, so
 * 600 ms let the next step start late; the drift tolerance itself is unchanged.
 */
const THINK_TIME_MS = 1500;
const FINAL_STATE = 'Ada Lovelace|agreed|sent';
const WAIT = { timeout: 10_000, interval: 50 };

describe('record, generate and replay round trip', () => {
  let server: FixtureServer;
  let scratch: string;
  let services: ComposedServices;
  let context: BrowserContext | null = null;
  let browser: PersistentBrowser | null = null;

  /** The real Patchright session, with the browser's context kept for the test. */
  const launcher: BrowserLauncher = {
    async launch(options) {
      browser = await launchPersistent({
        isHeadless: options.isHeadless,
        viewport: {
          width: options.display.width,
          height: options.display.height,
        },
      });
      context = browser.context;
      return startPatchrightSession({
        context,
        clock: createPerformanceClock(),
        inPageScriptPath: IN_PAGE_BUNDLE_PATH,
        startUrl: options.startUrl,
      });
    },
  };

  beforeAll(async () => {
    server = await startFixtureServer();
    // Inside the repository so the generated script resolves `playwright`.
    scratch = createScratchDir('e2e-');
    const paths = resolveProductionPaths(import.meta.url);
    services = createAppServices(
      createProductionDeps({
        paths: {
          ...paths,
          recordingsRoot: scratch,
          inPageScriptPath: IN_PAGE_BUNDLE_PATH,
        },
        isHeadless: true,
        launcher,
      }),
    );
  });

  afterAll(async () => {
    await services.persistActiveRecording();
    await browser?.dispose();
    await server.close();
    removeDirSync(scratch);
  });

  function recordingPage(): Page {
    const page = context?.pages().at(0);
    if (page === undefined) throw new Error('the recording has no page');
    return page;
  }

  async function userSession(live: LiveRecordingView): Promise<void> {
    let recordedKinds: readonly string[] = [];
    live.subscribe((update) => {
      recordedKinds = update.events.map((event) => event.kind);
    });
    const page = recordingPage();
    await page.waitForLoadState('load');
    await page.waitForTimeout(THINK_TIME_MS);
    await page.getByLabel('Full name').fill('Ada Lovelace');
    await page.waitForTimeout(THINK_TIME_MS);
    await page.getByLabel('I agree').check();
    await page.waitForTimeout(THINK_TIME_MS);
    await page.getByRole('button', { name: 'Send' }).click();
    await vi.waitFor(() => {
      expect(server.reports().at(-1)).toBe(FINAL_STATE);
    }, WAIT);
    // The page's own report can outrun the capture channel: stopping before
    // the click has arrived would lose it.
    await vi.waitFor(() => {
      expect(recordedKinds.at(-1)).toBe('click');
    }, WAIT);
  }

  async function replayAndObserve(slug = 'round-trip'): Promise<{
    final: ReplayView;
    startedOrder: number[];
  }> {
    const replay = await services.replay.start(slug, RECORDED_TIMING);
    const startedOrder: number[] = [];
    replay.subscribe((view) => {
      for (const step of view.steps) {
        const isStarted = step.status !== 'pending';
        if (isStarted && !startedOrder.includes(step.index)) {
          startedOrder.push(step.index);
        }
      }
    });
    return { final: await replay.finished, startedOrder };
  }

  it('replays what was recorded: same page state, steps in order, on time', async () => {
    await expect(
      services.environment.ensureBrowser(() => undefined),
    ).resolves.toMatchObject({ kind: 'ready' });

    const live = await services.recording.start({
      name: 'Round trip',
      startUrl: server.urlFor('roundtrip.html'),
      browser: BUNDLED_CHOICE,
    });
    await userSession(live);
    await live.stop();
    const recordedStates = server.reports();
    expect(recordedStates).toEqual([
      'Ada Lovelace||',
      'Ada Lovelace|agreed|',
      FINAL_STATE,
    ]);

    const recording = await services.library.load('round-trip');
    expect(recording.status).toBe('complete');
    // Exactly what the user did, in order: the pointer resting on a control
    // before it is used leaves no hover of its own.
    expect(recording.events.map((event) => event.kind)).toEqual([
      'goto',
      'fill',
      'check',
      'click',
    ]);

    server.clearReports();
    const { final, startedOrder } = await replayAndObserve();

    expect(final.errorMessage).toBeNull();
    expect(final.status).toBe('succeeded');
    const stepIndexes = recording.events.map((_event, index) => index);
    expect(startedOrder).toEqual(stepIndexes);
    expect(final.steps.map((step) => step.status)).toEqual(
      stepIndexes.map(() => 'done'),
    );
    expect(server.reports()).toEqual(recordedStates);
    for (const step of final.steps) {
      expect(Math.abs(step.driftMs ?? Infinity)).toBeLessThanOrEqual(
        DRIFT_TOLERANCE_MS,
      );
    }
  });

  interface ShadowState {
    readonly box: readonly number[];
    readonly deep: readonly number[];
    readonly spyCalls: number;
    readonly addedGlobals: readonly string[];
  }

  async function wheelOver(page: Page, selector: string): Promise<void> {
    const box = await page.locator(selector).boundingBox();
    if (box === null) throw new Error(`missing ${selector}`);
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(THINK_TIME_MS);
  }

  it('replays scrolls inside shadow roots to the exact positions that were recorded', async () => {
    const live = await services.recording.start({
      name: 'Shadow scroll',
      startUrl: server.urlFor('scroll-shadow.html'),
      browser: BUNDLED_CHOICE,
    });
    let recordedKinds: readonly string[] = [];
    live.subscribe((update) => {
      recordedKinds = update.events.map((event) => event.kind);
    });
    const page = recordingPage();
    await page.waitForLoadState('load');
    await page.waitForTimeout(THINK_TIME_MS);
    await wheelOver(page, '#box');
    await wheelOver(page, '#deep');
    server.clearReports();
    await page.locator('#report').click();
    await vi.waitFor(() => {
      expect(recordedKinds.at(-1)).toBe('click');
    }, WAIT);
    await vi.waitFor(() => {
      expect(server.reports()).toHaveLength(1);
    }, WAIT);
    await live.stop();
    const recordedState = JSON.parse(
      server.reports()[0] ?? '{}',
    ) as ShadowState;
    expect(recordedState.box[1]).toBeGreaterThan(0);
    expect(recordedState.deep[1]).toBeGreaterThan(0);

    const recording = await services.library.load('shadow-scroll');
    expect(recording.events.map((event) => event.kind)).toEqual([
      'goto',
      'scroll',
      'scroll',
      'click',
    ]);

    server.clearReports();
    const { final } = await replayAndObserve('shadow-scroll');
    expect(final.errorMessage).toBeNull();
    expect(final.status).toBe('succeeded');
    const replayed = JSON.parse(server.reports()[0] ?? '{}') as ShadowState;
    expect(replayed.box).toStrictEqual(recordedState.box);
    expect(replayed.deep).toStrictEqual(recordedState.deep);
    expect(replayed.spyCalls).toBe(0);
    expect(replayed.addedGlobals).toStrictEqual([]);
  });
});
