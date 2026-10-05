import type { CDPSession } from 'patchright';
import { BINDING_NAME, parseInPageText } from '../domain/in-page-message.ts';
import type { InPageMessage } from '../domain/in-page-message.ts';
import type { MonotonicClock } from '../application/ports/monotonic-clock.ts';

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

export interface CaptureWorld {
  /** The execution context of the isolated world in a frame, if it exists. */
  isolatedContextOf(frameId: string): number | undefined;
}

export interface CaptureOptions {
  readonly scriptSource: string;
  readonly clock: MonotonicClock;
  readonly onMessage: (captured: CapturedMessage) => void;
}

interface ContextCreated {
  readonly context: {
    readonly id: number;
    readonly name: string;
    readonly auxData?: { readonly frameId?: string };
  };
}

interface BindingCalled {
  readonly name: string;
  readonly payload: string;
  readonly executionContextId: number;
}

function trackWorldContexts(cdp: CDPSession): {
  frameOf: Map<number, string>;
  contextOf: Map<string, number>;
} {
  const frameOf = new Map<number, string>();
  const contextOf = new Map<string, number>();
  cdp.on('Runtime.executionContextCreated', (event: ContextCreated) => {
    const frameId = event.context.auxData?.frameId;
    if (event.context.name !== WORLD_NAME || frameId === undefined) return;
    frameOf.set(event.context.id, frameId);
    contextOf.set(frameId, event.context.id);
  });
  cdp.on(
    'Runtime.executionContextDestroyed',
    (event: { executionContextId: number }) => {
      const frameId = frameOf.get(event.executionContextId);
      frameOf.delete(event.executionContextId);
      if (
        frameId !== undefined &&
        contextOf.get(frameId) === event.executionContextId
      ) {
        contextOf.delete(frameId);
      }
    },
  );
  cdp.on('Runtime.executionContextsCleared', () => {
    frameOf.clear();
    contextOf.clear();
  });
  return { frameOf, contextOf };
}

/**
 * Runs the capture script in an isolated world of every frame of the page
 * behind `cdp` (now and on every future document) and receives what it
 * reports through a binding that exists in that world only.
 */
export async function attachCapture(
  cdp: CDPSession,
  options: CaptureOptions,
): Promise<CaptureWorld> {
  const { frameOf, contextOf } = trackWorldContexts(cdp);
  cdp.on('Runtime.bindingCalled', (event: BindingCalled) => {
    const receivedAt = options.clock.now();
    const frameId = frameOf.get(event.executionContextId);
    if (event.name !== BINDING_NAME || frameId === undefined) return;
    const message = parseInPageText(event.payload);
    if (message !== null) options.onMessage({ message, frameId, receivedAt });
  });
  // Scripts registered for new documents only run while the Page domain is
  // enabled in the session; a frame's own session is not enabled by anyone else.
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  // Added before the world exists: Chromium puts it into the world on creation.
  await cdp.send('Runtime.addBinding', {
    name: BINDING_NAME,
    executionContextName: WORLD_NAME,
  });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: options.scriptSource,
    worldName: WORLD_NAME,
    runImmediately: true,
  });
  return { isolatedContextOf: (frameId) => contextOf.get(frameId) };
}
