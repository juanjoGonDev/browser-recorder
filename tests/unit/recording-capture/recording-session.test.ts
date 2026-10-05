import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BrowserSession,
  LaunchOptions,
  SessionSignal,
} from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import type {
  LiveRecording,
  RecordingUpdate,
} from '../../../src/recording-capture/application/recording-session.ts';
import { startRecording } from '../../../src/recording-capture/application/recording-session.ts';
import type { Recording } from '../../../src/shared/domain/recording.ts';
import { createFakeClock } from '../../support/fake-clock.ts';
import type { FakeClock } from '../../support/fake-clock.ts';
import {
  clickPayload,
  domSignal,
  inputPayload,
  pageClosedSignal,
  pageOpenedSignal,
} from '../../support/session-signals.ts';

const START_MS = 5000;
const DEBOUNCE_MS = 250;

interface FakeBrowser extends BrowserSession {
  emit(signal: SessionSignal): void;
  readonly respond: ReturnType<typeof vi.fn<BrowserSession['respondToDialog']>>;
  readonly close: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

function createFakeBrowser(): FakeBrowser {
  let listener: (signal: SessionSignal) => void = () => undefined;
  const respond = vi.fn<BrowserSession['respondToDialog']>(() =>
    Promise.resolve(),
  );
  return {
    onSignal: (next) => {
      listener = next;
    },
    emit: (signal) => {
      listener(signal);
    },
    respond,
    respondToDialog: respond,
    close: vi.fn(() => Promise.resolve()),
  };
}

interface Harness {
  readonly browser: FakeBrowser;
  readonly clock: FakeClock;
  readonly saves: Recording[];
  readonly launches: LaunchOptions[];
  readonly failures: { didFailNext: boolean };
  readonly updates: RecordingUpdate[];
  readonly live: LiveRecording;
}

async function begin(startUrl: string | null = null): Promise<Harness> {
  const browser = createFakeBrowser();
  const clock = createFakeClock(START_MS);
  const saves: Recording[] = [];
  const launches: LaunchOptions[] = [];
  const failures = { didFailNext: false };
  const live = await startRecording(
    {
      launcher: {
        launch: (options) => {
          launches.push(options);
          return Promise.resolve(browser);
        },
      },
      clock,
      sink: {
        save: (recording) => {
          if (failures.didFailNext) {
            failures.didFailNext = false;
            return Promise.reject(new Error('disk full'));
          }
          saves.push(recording);
          return Promise.resolve();
        },
      },
      now: () => new Date('2026-03-04T05:06:07.000Z'),
    },
    { name: 'Checkout flow', slug: 'checkout-flow', startUrl },
  );
  const updates: RecordingUpdate[] = [];
  live.subscribe((update) => updates.push(update));
  return { browser, clock, saves, launches, failures, updates, live };
}

function click(harness: Harness, afterMs: number): void {
  harness.browser.emit(domSignal(START_MS + afterMs, clickPayload()));
}

describe('src/recording-capture/application/recording-session.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('starting', () => {
    it('launches a headed browser at the start URL with the default viewport', async () => {
      const harness = await begin('https://a.test/');
      expect(harness.launches).toEqual([
        {
          startUrl: 'https://a.test/',
          viewport: { width: 1280, height: 800 },
          isHeadless: false,
        },
      ]);
    });

    it('launches with no start URL when there is none', async () => {
      const harness = await begin();
      expect(harness.launches[0]?.startUrl).toBeNull();
    });
  });

  describe('events', () => {
    it('publishes the timeline with offsets from the session start', async () => {
      const harness = await begin();
      click(harness, 120);
      harness.browser.emit(domSignal(START_MS + 300, inputPayload('hey')));
      const last = harness.updates.at(-1);
      expect(last?.events).toMatchObject([
        { kind: 'click', offsetMs: 120 },
        { kind: 'fill', value: 'hey', offsetMs: 300 },
      ]);
      expect(last).toMatchObject({ pendingDialog: null, isClosed: false });
    });

    it('stops publishing to a listener that unsubscribed', async () => {
      const harness = await begin();
      const received: RecordingUpdate[] = [];
      const unsubscribe = harness.live.subscribe((update) =>
        received.push(update),
      );
      click(harness, 10);
      unsubscribe();
      click(harness, 900);
      expect(received).toHaveLength(1);
    });
  });

  describe('debounced saving', () => {
    it('saves once, 250 ms after the last event, with every event so far', async () => {
      const harness = await begin();
      click(harness, 10);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
      click(harness, 200);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
      expect(harness.saves).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(harness.saves).toHaveLength(1);
      expect(harness.saves[0]).toMatchObject({
        status: 'recording',
        events: [{ offsetMs: 10 }, { offsetMs: 200 }],
      });
    });

    it('does not save when nothing was recorded', async () => {
      const harness = await begin();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 4);
      expect(harness.saves).toEqual([]);
    });

    it('keeps the previous save when a write fails, and saves again later', async () => {
      const harness = await begin();
      click(harness, 10);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      harness.failures.didFailNext = true;
      click(harness, 400);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      expect(harness.saves).toHaveLength(1);
      expect(harness.saves[0]?.events).toHaveLength(1);
      click(harness, 800);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      expect(harness.saves.at(-1)?.events).toHaveLength(3);
    });
  });

  describe('stop', () => {
    it('saves the complete recording and closes the browser', async () => {
      const harness = await begin('https://a.test/');
      for (const afterMs of [10, 20, 30, 40, 50]) click(harness, afterMs * 100);
      harness.clock.advance(7000);
      const recording = await harness.live.stop();
      expect(recording).toMatchObject({
        schemaVersion: 1,
        name: 'Checkout flow',
        slug: 'checkout-flow',
        startUrl: 'https://a.test/',
        status: 'complete',
        durationMs: 7000,
        viewport: { width: 1280, height: 800 },
        createdAt: '2026-03-04T05:06:07.000Z',
        updatedAt: '2026-03-04T05:06:07.000Z',
      });
      expect(recording.events).toHaveLength(5);
      expect(harness.saves.at(-1)).toEqual(recording);
      expect(harness.browser.close).toHaveBeenCalledTimes(1);
      expect(harness.updates.at(-1)?.isClosed).toBe(true);
    });

    it('lasts at least until the last event', async () => {
      const harness = await begin();
      click(harness, 9000);
      const recording = await harness.live.stop();
      expect(recording.durationMs).toBe(9000);
    });

    it('cancels the pending debounced save instead of saving twice', async () => {
      const harness = await begin();
      click(harness, 10);
      await harness.live.stop();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
      expect(harness.saves).toHaveLength(1);
      expect(harness.saves[0]?.status).toBe('complete');
    });

    it('answers a second stop with the same recording and saves once', async () => {
      const harness = await begin();
      click(harness, 10);
      const first = await harness.live.stop();
      const second = await harness.live.stop();
      expect(second).toBe(first);
      expect(harness.saves).toHaveLength(1);
      expect(harness.browser.close).toHaveBeenCalledTimes(1);
    });

    it('ignores signals that arrive after it', async () => {
      const harness = await begin();
      const recording = await harness.live.stop();
      click(harness, 10);
      expect(recording.events).toEqual([]);
      expect(harness.updates.at(-1)?.events).toEqual([]);
    });

    it('closes the browser and rejects when the final save fails', async () => {
      const harness = await begin();
      click(harness, 10);
      harness.failures.didFailNext = true;
      await expect(harness.live.stop()).rejects.toThrow('disk full');
      expect(harness.browser.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('the browser going away', () => {
    it('saves, closes and ends the session when the browser closes', async () => {
      const harness = await begin();
      click(harness, 10);
      harness.browser.emit({
        kind: 'browser-closed',
        receivedAt: START_MS + 20,
        pageId: 'page1',
      });
      const recording = await harness.live.stop();
      expect(recording.status).toBe('complete');
      expect(recording.events).toHaveLength(1);
      expect(harness.saves).toHaveLength(1);
      expect(harness.updates.at(-1)?.isClosed).toBe(true);
      expect(harness.browser.close).toHaveBeenCalledTimes(1);
    });

    it('ends the session when the last page closes', async () => {
      const harness = await begin();
      harness.browser.emit(pageOpenedSignal(START_MS + 10, 'page2'));
      harness.browser.emit(pageClosedSignal(START_MS + 20, 'page2'));
      expect(harness.updates.at(-1)?.isClosed).toBe(false);
      harness.browser.emit(pageClosedSignal(START_MS + 30, 'page1'));
      const recording = await harness.live.stop();
      expect(harness.updates.at(-1)?.isClosed).toBe(true);
      expect(recording.events.map((event) => event.kind)).toEqual([
        'page-opened',
        'page-closed',
      ]);
    });
  });

  describe('dialogs', () => {
    const opened: SessionSignal = {
      kind: 'dialog-opened',
      receivedAt: START_MS + 100,
      pageId: 'page1',
      dialogType: 'prompt',
      message: 'Name?',
      defaultValue: '',
    };

    it('holds the dialog as pending until it is answered', async () => {
      const harness = await begin();
      harness.browser.emit(opened);
      expect(harness.updates.at(-1)?.pendingDialog).toEqual(opened);
    });

    it('answers the browser and records the dialog event', async () => {
      const harness = await begin();
      click(harness, 50);
      harness.browser.emit(opened);
      harness.clock.advance(900);
      await harness.live.respondToDialog({
        action: 'accept',
        promptText: 'abc',
      });
      expect(harness.browser.respond).toHaveBeenCalledWith({
        action: 'accept',
        promptText: 'abc',
      });
      const last = harness.updates.at(-1);
      expect(last?.pendingDialog).toBeNull();
      expect(last?.events[1]).toMatchObject({
        kind: 'dialog',
        dialogType: 'prompt',
        message: 'Name?',
        action: 'accept',
        promptText: 'abc',
        offsetMs: 900,
      });
    });

    it('keeps the dialog pending when the browser refuses the answer', async () => {
      const harness = await begin();
      harness.browser.emit(opened);
      harness.browser.respond.mockRejectedValueOnce(new Error('page closed'));
      await expect(
        harness.live.respondToDialog({ action: 'dismiss', promptText: null }),
      ).rejects.toThrow('page closed');
      expect(harness.updates.at(-1)?.pendingDialog).toEqual(opened);
    });

    it('forwards an answer when no dialog is pending without recording one', async () => {
      const harness = await begin();
      await harness.live.respondToDialog({
        action: 'accept',
        promptText: null,
      });
      expect(harness.browser.respond).toHaveBeenCalledTimes(1);
      expect(harness.updates).toEqual([]);
    });
  });

  describe('discard', () => {
    it('closes the browser and never saves the discarded recording', async () => {
      const harness = await begin();
      click(harness, 10);
      await harness.live.discard();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
      expect(harness.saves).toEqual([]);
      expect(harness.browser.close).toHaveBeenCalledTimes(1);
      expect(harness.updates.at(-1)?.isClosed).toBe(true);
    });

    it('cannot be stopped afterwards', async () => {
      const harness = await begin();
      await harness.live.discard();
      await expect(harness.live.stop()).rejects.toThrow('discarded');
    });

    it('does nothing once the recording was stopped', async () => {
      const harness = await begin();
      await harness.live.stop();
      await harness.live.discard();
      expect(harness.browser.close).toHaveBeenCalledTimes(1);
    });
  });
});
