import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import type { BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAppServices } from '../../src/composition/create-app-services.ts';
import type { ComposedServices } from '../../src/composition/create-app-services.ts';
import {
  createProductionDeps,
  resolveProductionPaths,
} from '../../src/composition/create-production-services.ts';
import { createPerformanceClock } from '../../src/recording-capture/adapters/performance-clock.ts';
import { startPlaywrightSession } from '../../src/recording-capture/adapters/playwright-browser-session.ts';
import type { BrowserLauncher } from '../../src/recording-capture/application/ports/browser-launcher.ts';
import type {
  LiveRecordingView,
  ReplayView,
} from '../../src/tui/domain/app-views.ts';
import { IN_PAGE_BUNDLE_PATH } from '../support/build-in-page-bundle.ts';
import type { FixtureServer } from '../support/fixture-server.ts';
import { startFixtureServer } from '../support/fixture-server.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCRATCH_PARENT = path.join(ROOT, 'recordings');
/** Design: every replayed step starts within this of its recorded offset. */
const DRIFT_TOLERANCE_MS = 100;
/** Gaps between the user's actions: long enough that no step is late. */
const THINK_TIME_MS = 600;
const FINAL_STATE = 'Ada Lovelace|agreed|sent';
const WAIT = { timeout: 10_000, interval: 50 };

describe('record, generate and replay round trip', () => {
  let server: FixtureServer;
  let scratch: string;
  let services: ComposedServices;
  let context: BrowserContext | null = null;

  /** The real Playwright session, with the browser's context kept for the test. */
  const launcher: BrowserLauncher = {
    async launch(options) {
      const browser = await chromium.launch({ headless: options.isHeadless });
      context = await browser.newContext({ viewport: options.viewport });
      return startPlaywrightSession({
        browser,
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
    mkdirSync(SCRATCH_PARENT, { recursive: true });
    scratch = mkdtempSync(path.join(SCRATCH_PARENT, 'e2e-'));
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
    await server.close();
    rmSync(scratch, { recursive: true, force: true });
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

  async function replayAndObserve(): Promise<{
    final: ReplayView;
    startedOrder: number[];
  }> {
    const replay = await services.replay.start('round-trip');
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
});
