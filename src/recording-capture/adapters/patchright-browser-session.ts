import { readFileSync } from 'node:fs';
import type { BrowserContext, Page } from 'patchright';
import type { BrowserSession } from '../application/ports/browser-launcher.ts';
import type { MonotonicClock } from '../application/ports/monotonic-clock.ts';
import { createDialogRegistry } from './dialog-registry.ts';
import { createPageIds } from './page-ids.ts';
import type { PageIds } from './page-ids.ts';
import { wirePage } from './page-wiring.ts';
import type { WiringDeps } from './page-wiring.ts';
import { createSignalHub } from './signal-hub.ts';
import { createSignalQueue } from './signal-queue.ts';
import type { SignalQueue } from './signal-queue.ts';

export interface PatchrightSessionDeps {
  readonly context: BrowserContext;
  readonly clock: MonotonicClock;
  /** The bundled capture script (`dist/in-page/capture-script.js`). */
  readonly inPageScriptPath: string;
  readonly startUrl: string | null;
}

interface Lifecycle {
  readonly queue: SignalQueue;
  readonly ids: PageIds;
  readonly emit: WiringDeps['emit'];
  readonly clock: MonotonicClock;
  readonly context: BrowserContext;
}

function watchClosing(page: Page, life: Lifecycle, end: () => void): void {
  page.on('close', () => {
    const receivedAt = life.clock.now();
    life.queue.enqueue(() => {
      const pageId = life.ids.idOf(page);
      life.emit({ kind: 'page-closed', pageId, receivedAt });
      if (life.context.pages().every((open) => open.isClosed())) end();
      return Promise.resolve();
    });
  });
}

function watchNewPages(
  life: Lifecycle,
  wiring: WiringDeps,
  end: () => void,
): void {
  life.context.on('page', (page) => {
    const receivedAt = life.clock.now();
    watchClosing(page, life, end);
    life.queue.enqueue(async () => {
      const opener = await page.opener();
      life.emit({
        kind: 'page-opened',
        pageId: life.ids.idOf(page),
        receivedAt,
        openerPageId: opener === null ? null : life.ids.knownIdOf(opener),
        url: page.url(),
      });
      await wirePage(page, wiring);
    });
  });
}

function createParts(deps: PatchrightSessionDeps) {
  const hub = createSignalHub();
  const state = { isClosing: false, isEnded: false };
  const emit: WiringDeps['emit'] = (signal) => {
    if (!state.isClosing) hub.emit(signal);
  };
  const life: Lifecycle = {
    queue: createSignalQueue(),
    ids: createPageIds(),
    emit,
    clock: deps.clock,
    context: deps.context,
  };
  const dialogs = createDialogRegistry();
  const wiring: WiringDeps = {
    ...life,
    dialogs,
    scriptSource: readFileSync(deps.inPageScriptPath, 'utf8'),
  };
  const end = (): void => {
    if (state.isEnded) return;
    state.isEnded = true;
    emit({
      kind: 'browser-closed',
      pageId: 'page1',
      receivedAt: deps.clock.now(),
    });
  };
  return { hub, state, life, dialogs, wiring, end };
}

/**
 * Takes over the first page of a recorded browser and returns the session that
 * reports what happens in it. A headed browser also shows its own native
 * dialog next to the recorder's prompt (see the headed dialog test): a dialog
 * can be answered from either place and both answers are recorded.
 */
export async function startPatchrightSession(
  deps: PatchrightSessionDeps,
): Promise<BrowserSession> {
  const { hub, state, life, dialogs, wiring, end } = createParts(deps);
  // A persistent context opens its first page itself; a second one would
  // leave a stray blank tab in the user's window.
  const first = deps.context.pages()[0] ?? (await deps.context.newPage());
  watchClosing(first, life, end);
  const wired = await wirePage(first, wiring);
  watchNewPages(life, wiring, end);
  deps.context.on('close', () => {
    life.queue.enqueue(() => {
      end();
      return Promise.resolve();
    });
  });
  // An unreachable start page still leaves a browser the user can work in.
  if (deps.startUrl !== null)
    await first.goto(deps.startUrl).catch(() => undefined);
  // The page is captured from the moment the recorder is shown, not a few
  // milliseconds later.
  await wired.settled();
  return {
    onSignal: (listener) => {
      hub.onSignal(listener);
    },
    respondToDialog: (response) => dialogs.respond(response),
    async close() {
      if (state.isClosing) return;
      state.isClosing = true;
      await life.queue.idle();
      await deps.context.close();
    },
  };
}
