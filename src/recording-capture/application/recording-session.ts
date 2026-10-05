import type { RecordingEvent } from '../../shared/domain/recording-event.ts';
import type { Recording, Viewport } from '../../shared/domain/recording.ts';
import type {
  BrowserLauncher,
  BrowserSession,
  SessionSignal,
} from './ports/browser-launcher.ts';
import type { MonotonicClock } from './ports/monotonic-clock.ts';
import type { RecordingSink } from './ports/recording-sink.ts';
import {
  applyDialogAnswer,
  applySignal,
  createTimeline,
} from './session-timeline.ts';
import type { Timeline } from './session-timeline.ts';

/** The window size replay recreates, so recorded coordinates still apply. */
const DEFAULT_VIEWPORT: Viewport = { width: 1280, height: 800 };
/** Writes wait this long for a quiet moment so a typing burst saves once. */
const SAVE_DEBOUNCE_MS = 250;

export interface RecordingUpdate {
  readonly events: readonly RecordingEvent[];
  readonly pendingDialog: SessionSignal | null;
  readonly isClosed: boolean;
}

export interface LiveRecording {
  subscribe(listener: (update: RecordingUpdate) => void): () => void;
  respondToDialog: BrowserSession['respondToDialog'];
  stop(): Promise<Recording>;
  discard(): Promise<void>;
}

export interface StartRecordingDeps {
  readonly launcher: BrowserLauncher;
  readonly clock: MonotonicClock;
  readonly sink: RecordingSink;
  readonly now: () => Date;
  /** Opens no window; the composition sets it for tests and automation. */
  readonly isHeadless?: boolean;
}

export interface StartRecordingRequest {
  readonly name: string;
  readonly slug: string;
  readonly startUrl: string | null;
}

type DialogSignal = Extract<SessionSignal, { kind: 'dialog-opened' }>;
type Listener = (update: RecordingUpdate) => void;

/** One live session: owns the timeline, the debounced saves and the end. */
class RecordingRun implements LiveRecording {
  private timeline: Timeline;
  private pendingDialog: DialogSignal | null = null;
  private isClosed = false;
  private readonly listeners = new Set<Listener>();
  private saves: Promise<void> = Promise.resolve();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private outcome: Promise<Recording | null> | null = null;
  private readonly createdAt: string;
  private readonly deps: StartRecordingDeps;
  private readonly request: StartRecordingRequest;
  private readonly browser: BrowserSession;

  constructor(
    deps: StartRecordingDeps,
    request: StartRecordingRequest,
    browser: BrowserSession,
  ) {
    this.deps = deps;
    this.request = request;
    this.browser = browser;
    this.timeline = createTimeline(deps.clock.now());
    this.createdAt = deps.now().toISOString();
    browser.onSignal((signal) => {
      this.handle(signal);
    });
  }

  respondToDialog: BrowserSession['respondToDialog'] = async (response) => {
    await this.browser.respondToDialog(response);
    const dialog = this.pendingDialog;
    if (dialog === null || this.outcome !== null) return;
    this.pendingDialog = null;
    this.timeline = applyDialogAnswer(this.timeline, {
      dialog,
      answer: response,
      nowMs: this.deps.clock.now(),
    });
    this.scheduleSave();
    this.publish();
  };

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async stop(): Promise<Recording> {
    this.outcome ??= this.finish();
    const recording = await this.outcome;
    if (recording === null) throw new Error('The recording was discarded');
    return recording;
  }

  async discard(): Promise<void> {
    this.outcome ??= this.abandon();
    await this.outcome.catch(() => undefined);
  }

  private handle(signal: SessionSignal): void {
    if (this.outcome !== null) return;
    if (signal.kind === 'browser-closed') {
      this.end();
    } else if (signal.kind === 'dialog-opened') {
      this.pendingDialog = signal;
      this.publish();
    } else if (signal.kind === 'dialog-closed') {
      this.pendingDialog = null;
      this.record(signal);
    } else {
      this.record(signal);
    }
  }

  private record(signal: SessionSignal): void {
    this.timeline = applySignal(this.timeline, signal);
    if (this.timeline.hasEnded) {
      this.end();
      return;
    }
    this.scheduleSave();
    this.publish();
  }

  /** The browser is gone on its own: save what there is and wrap up. */
  private end(): void {
    this.outcome = this.finish();
    // A failed save is reported to whoever calls stop(); nobody awaits this one.
    this.outcome.catch(() => undefined);
  }

  private async finish(): Promise<Recording> {
    this.cancelSave();
    try {
      await this.saves;
      const recording = this.snapshot('complete');
      await this.deps.sink.save(recording);
      return recording;
    } finally {
      await this.closeBrowser();
      this.markClosed();
    }
  }

  private async abandon(): Promise<null> {
    this.cancelSave();
    await this.saves;
    await this.closeBrowser();
    this.markClosed();
    return null;
  }

  private markClosed(): void {
    this.isClosed = true;
    this.pendingDialog = null;
    this.publish();
  }

  private async closeBrowser(): Promise<void> {
    // The browser may already be gone; closing it again is not an error.
    await this.browser.close().catch(() => undefined);
  }

  private snapshot(status: Recording['status']): Recording {
    const elapsedMs = Math.round(this.deps.clock.now() - this.timeline.t0);
    return {
      schemaVersion: 1,
      name: this.request.name,
      slug: this.request.slug,
      startUrl: this.request.startUrl,
      createdAt: this.createdAt,
      updatedAt: this.deps.now().toISOString(),
      status,
      durationMs: Math.max(this.timeline.lastOffsetMs, elapsedMs),
      viewport: DEFAULT_VIEWPORT,
      events: this.timeline.events,
    };
  }

  private scheduleSave(): void {
    this.cancelSave();
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.enqueueSave();
    }, SAVE_DEBOUNCE_MS);
  }

  /** Saves run one at a time; a failed one leaves the previous file intact. */
  private enqueueSave(): void {
    const recording = this.snapshot('recording');
    this.saves = this.saves
      .then(() => this.deps.sink.save(recording))
      .catch(() => undefined);
  }

  private cancelSave(): void {
    if (this.saveTimer === null) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  private publish(): void {
    const update: RecordingUpdate = {
      events: this.timeline.events,
      pendingDialog: this.pendingDialog,
      isClosed: this.isClosed,
    };
    for (const listener of this.listeners) listener(update);
  }
}

export async function startRecording(
  deps: StartRecordingDeps,
  request: StartRecordingRequest,
): Promise<LiveRecording> {
  const browser = await deps.launcher.launch({
    startUrl: request.startUrl,
    viewport: DEFAULT_VIEWPORT,
    isHeadless: deps.isHeadless ?? false,
  });
  return new RecordingRun(deps, request, browser);
}
