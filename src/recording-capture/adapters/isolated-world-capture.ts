import type { CDPSession } from 'patchright';
import { BINDING_NAME, parseInPageText } from '../domain/in-page-message.ts';
import type { InPageMessage } from '../domain/in-page-message.ts';
import type { CaptureWorld } from '../application/ports/capture-world.ts';
import type { MonotonicClock } from '../application/ports/monotonic-clock.ts';
import { createWorldContexts, listFrameIds } from './world-contexts.ts';
import type { WorldContexts } from './world-contexts.ts';

/**
 * The name of the CDP isolated world the capture script lives in. Like the
 * Chrome DevTools Recorder, the recorder never runs code in the page's own
 * world: page scripts cannot see the script, its binding or any global it
 * defines, and a page's Content-Security-Policy does not apply to it.
 */
export const WORLD_NAME = '__browser_recorder';

export interface CapturedMessage {
  readonly message: InPageMessage;
  /** The CDP frame the capture script that reported it runs in. */
  readonly frameId: string;
  /** Stamped when the binding call reached Node. */
  readonly receivedAt: number;
}

export interface AttachedCapture extends CaptureWorld {
  /** Resolves once every frame being prepared right now has its script. */
  settled(): Promise<void>;
}

export interface CaptureOptions {
  readonly scriptSource: string;
  readonly clock: MonotonicClock;
  readonly onMessage: (captured: CapturedMessage) => void;
}

interface BindingCalled {
  readonly name: string;
  readonly payload: string;
  readonly executionContextId: number;
}

interface PreparingSession {
  readonly cdp: CDPSession;
  readonly worlds: WorldContexts;
  readonly scriptSource: string;
}

/**
 * Puts the capture script into the world of one frame. The binding is added
 * after the world exists because a binding added earlier is not installed in a
 * world that does not exist yet; adding it again is idempotent. A frame that
 * vanished meanwhile simply stays without capture.
 */
async function prepareFrame(
  session: PreparingSession,
  frameId: string,
): Promise<void> {
  const { cdp, worlds, scriptSource } = session;
  try {
    const contextId = await worlds.contextOf(frameId);
    if (contextId === undefined) return;
    await cdp.send('Runtime.addBinding', {
      name: BINDING_NAME,
      executionContextName: WORLD_NAME,
    });
    await cdp.send('Runtime.evaluate', {
      contextId,
      expression: scriptSource,
    });
  } catch {
    // The frame went away while it was being prepared.
  }
}

function deliver(
  options: CaptureOptions,
  event: BindingCalled,
  frame: { readonly frameId: string; readonly receivedAt: number },
): void {
  const message = parseInPageText(event.payload);
  if (message !== null) options.onMessage({ message, ...frame });
}

/** The frame of a call, after refreshing the frame tree when it is unknown. */
async function frameOfLate(
  worlds: WorldContexts,
  contextId: number,
): Promise<string | undefined> {
  const known = worlds.frameOf(contextId);
  if (known !== undefined) return known;
  await worlds.refresh();
  return worlds.frameOf(contextId);
}

/**
 * Hands each binding call to `onMessage` in arrival order. A call from a
 * context nobody knows (its frame navigated and the new world is not
 * registered yet) refreshes the frame tree once; calls that arrive meanwhile
 * wait behind it so the order never changes.
 */
function createDispatcher(
  worlds: WorldContexts,
  options: CaptureOptions,
): (event: BindingCalled) => void {
  let backlog: Promise<void> | null = null;
  return (event) => {
    const receivedAt = options.clock.now();
    if (event.name !== BINDING_NAME) return;
    const frameId =
      backlog === null ? worlds.frameOf(event.executionContextId) : undefined;
    if (frameId !== undefined) {
      deliver(options, event, { frameId, receivedAt });
      return;
    }
    const current = (backlog ?? Promise.resolve())
      .then(async () => {
        const late = await frameOfLate(worlds, event.executionContextId);
        if (late !== undefined) {
          deliver(options, event, { frameId: late, receivedAt });
        }
      })
      .catch(() => undefined);
    backlog = current;
    void current.then(() => {
      if (backlog === current) backlog = null;
    });
  };
}

/**
 * Runs the capture script in an isolated world of every frame of the page
 * behind `cdp` and receives what it reports through a binding that exists in
 * that world only. Without the Runtime domain nothing announces new documents
 * to the script, so a frame is prepared when it exists at attach time and
 * again each time it commits a document.
 */
export async function attachCapture(
  cdp: CDPSession,
  options: CaptureOptions,
): Promise<AttachedCapture> {
  const worlds = createWorldContexts(cdp, WORLD_NAME);
  const session = { cdp, worlds, scriptSource: options.scriptSource };
  const inFlight = new Set<Promise<void>>();
  const prepare = (frameId: string): Promise<void> => {
    const preparing = prepareFrame(session, frameId);
    inFlight.add(preparing);
    void preparing.then(() => inFlight.delete(preparing));
    return preparing;
  };
  cdp.on('Runtime.bindingCalled', createDispatcher(worlds, options));
  cdp.on('Page.frameNavigated', (event) => {
    void prepare(event.frame.id);
  });
  await cdp.send('Page.enable');
  for (const frameId of await listFrameIds(cdp)) await prepare(frameId);
  return {
    contextOf: (frameId) => worlds.contextOf(frameId),
    async settled() {
      while (inFlight.size > 0) await Promise.all([...inFlight]);
    },
  };
}
