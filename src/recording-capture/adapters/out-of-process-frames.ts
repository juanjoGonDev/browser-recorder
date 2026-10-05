import type { BrowserContext, Frame, Page } from 'playwright';
import type { FrameHosts } from './frame-path-resolver.ts';
import { attachCapture } from './isolated-world-capture.ts';
import type { CaptureOptions } from './isolated-world-capture.ts';

export interface OutOfProcessDeps {
  readonly context: BrowserContext;
  readonly hosts: FrameHosts;
  readonly capture: CaptureOptions;
}

/**
 * Chromium puts a cross-site iframe in a renderer process of its own, so the
 * page's CDP session never sees that frame. Playwright keeps a session for
 * such a frame (the target it auto-attached); asking it for one fails for an
 * ordinary same-process frame, which the page's own session already covers.
 * This installs the same isolated-world capture in every such frame.
 *
 * (`Target.setAutoAttach` on the page session would attach the same target,
 * but Playwright's session API cannot address the child session it creates,
 * so a `waitForDebuggerOnStart` attach would never be resumed.)
 */
async function attach(
  frame: Frame,
  deps: OutOfProcessDeps,
  onClosed: () => void,
): Promise<boolean> {
  try {
    const cdp = await deps.context.newCDPSession(frame);
    const world = await attachCapture(cdp, deps.capture);
    const remove = deps.hosts.add({ cdp, world });
    cdp.on('close', () => {
      remove();
      onClosed();
    });
    return true;
  } catch {
    // Not an out-of-process frame, or it went away while being set up.
    return false;
  }
}

export function captureOutOfProcessFrames(
  page: Page,
  deps: OutOfProcessDeps,
): void {
  const attached = new WeakSet<Frame>();
  const tryAttach = (frame: Frame): void => {
    if (frame === page.mainFrame() || attached.has(frame)) return;
    attached.add(frame);
    const onClosed = (): void => {
      attached.delete(frame);
      // The frame may have moved to another process: look again.
      if (!frame.isDetached()) tryAttach(frame);
    };
    void attach(frame, deps, onClosed).then((isAttached) => {
      if (!isAttached) attached.delete(frame);
    });
  };
  page.on('framenavigated', tryAttach);
}
