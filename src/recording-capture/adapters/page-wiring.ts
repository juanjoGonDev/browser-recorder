import type { BrowserContext, Dialog, Page } from 'playwright';
import type { Locator } from '../../shared/domain/locator.ts';
import type { PageId } from '../../shared/domain/recording-event.ts';
import type { SessionSignal } from '../application/ports/browser-launcher.ts';
import type { MonotonicClock } from '../application/ports/monotonic-clock.ts';
import type { CapturedEvent } from '../domain/captured-event.ts';
import type { DialogRegistry } from './dialog-registry.ts';
import { createFramePathResolver } from './frame-path-resolver.ts';
import type { FramePathResolver } from './frame-path-resolver.ts';
import { attachCapture } from './isolated-world-capture.ts';
import type { CapturedMessage } from './isolated-world-capture.ts';
import { scopeOfFrame, verifyInScope } from './locator-verifier.ts';
import type { LocatorScope } from './locator-verifier.ts';
import { trackNavigation } from './navigation-tracker.ts';
import type { PageIds } from './page-ids.ts';
import type { SignalQueue } from './signal-queue.ts';

export interface WiringDeps {
  readonly context: BrowserContext;
  readonly clock: MonotonicClock;
  readonly scriptSource: string;
  readonly queue: SignalQueue;
  readonly ids: PageIds;
  readonly dialogs: DialogRegistry;
  readonly emit: (signal: SessionSignal) => void;
}

// A page blocked on a dialog answers no CDP call until the dialog is
// answered; the signal must not wait for it or the dialog would never surface.
const FRAME_PATH_DEADLINE_MS = 400;

async function withDeadline<T>(
  work: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallback);
    }, ms);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

async function verifyPayload(
  scope: LocatorScope,
  payload: CapturedEvent,
): Promise<CapturedEvent> {
  if (payload.kind !== 'drag') return payload;
  const candidates = await verifyInScope(scope, payload.source.candidates);
  return { ...payload, source: { ...payload.source, candidates } };
}

interface Reported {
  readonly page: Page;
  readonly pageId: PageId;
  readonly captured: CapturedMessage;
}

async function toDomSignal(
  { page, pageId, captured }: Reported,
  framePath: readonly string[],
): Promise<SessionSignal> {
  const scope = scopeOfFrame(page, framePath);
  const candidates: readonly Locator[] = await verifyInScope(
    scope,
    captured.message.candidates,
  );
  return {
    kind: 'dom',
    pageId,
    receivedAt: captured.receivedAt,
    framePath,
    payload: await verifyPayload(scope, captured.message.payload),
    candidates,
  };
}

function watchDialogs(page: Page, pageId: PageId, deps: WiringDeps): void {
  page.on('dialog', (dialog: Dialog) => {
    const receivedAt = deps.clock.now();
    deps.dialogs.add(dialog);
    deps.queue.enqueue(() => {
      deps.emit({
        kind: 'dialog-opened',
        pageId,
        receivedAt,
        dialogType: dialog.type() as
          'alert' | 'confirm' | 'prompt' | 'beforeunload',
        message: dialog.message(),
        defaultValue: dialog.defaultValue(),
      });
      return Promise.resolve();
    });
  });
}

/**
 * Connects one page to the session: capture in a CDP isolated world,
 * navigation classified over CDP, dialogs from Playwright events. Nothing is
 * evaluated or exposed in the page's own world.
 */
export async function wirePage(page: Page, deps: WiringDeps): Promise<void> {
  const pageId = deps.ids.idOf(page);
  const cdp = await deps.context.newCDPSession(page);
  const resolver: { current: FramePathResolver | null } = { current: null };
  const world = await attachCapture(cdp, {
    scriptSource: deps.scriptSource,
    clock: deps.clock,
    onMessage: (captured) => {
      deps.queue.enqueue(async () => {
        const path = await withDeadline(
          resolver.current?.resolve(captured.frameId) ?? Promise.resolve([]),
          FRAME_PATH_DEADLINE_MS,
          [],
        );
        deps.emit(await toDomSignal({ page, pageId, captured }, path));
      });
    },
  });
  resolver.current = createFramePathResolver(cdp, world);
  await trackNavigation(cdp, {
    now: () => deps.clock.now(),
    onNavigation: (report) => {
      deps.queue.enqueue(() => {
        deps.emit({ kind: 'navigation', pageId, ...report });
        return Promise.resolve();
      });
    },
  });
  watchDialogs(page, pageId, deps);
}
