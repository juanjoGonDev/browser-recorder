import type { CDPSession } from 'patchright';
import type { NavigationType } from '../application/ports/browser-launcher.ts';

export interface NavigationReport {
  readonly url: string;
  readonly navigationType: NavigationType;
  /** Position in the session history right after the navigation committed. */
  readonly entryIndex: number | null;
  /** Stamped when the browser reported the commit. */
  readonly receivedAt: number;
}

const CDP_TYPES: Readonly<Record<string, NavigationType>> = {
  reload: 'reload',
  reloadBypassingCache: 'reload',
  historyDifferentDocument: 'back_forward',
  historySameDocument: 'traverse',
  differentDocument: 'navigate',
  sameDocument: 'push',
};

const WITHIN_DOCUMENT_TYPES: Readonly<Record<string, NavigationType>> = {
  fragment: 'push',
  historyApi: 'push',
};

const NOT_REPORTED = /^(?:about|chrome-error):/;
// The renderer reports a commit before the browser makes the new document the
// active one; until then the history read fails with "Not attached to an
// active page". A slow machine widens that gap, so the read is retried.
const HISTORY_READ_ATTEMPTS = 40;
const HISTORY_READ_RETRY_MS = 25;

/** The navigation type CDP announced, in the vocabulary of the signals. */
export function navigationTypeOf(
  cdpType: string | undefined,
  withinDocumentType?: string,
): NavigationType {
  const announced = cdpType === undefined ? undefined : CDP_TYPES[cdpType];
  const within =
    withinDocumentType === undefined
      ? undefined
      : WITHIN_DOCUMENT_TYPES[withinDocumentType];
  return announced ?? within ?? 'unknown';
}

interface Started {
  readonly navigationType?: string;
}
interface Navigated {
  readonly frame: { readonly url: string; readonly parentId?: string };
}
interface WithinDocument {
  readonly frameId: string;
  readonly url: string;
  readonly navigationType?: string;
}

interface Deps {
  readonly now: () => number;
  readonly onNavigation: (report: NavigationReport) => void;
  /** Waits between history reads; a real timer unless a test replaces it. */
  readonly sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function entryIndexOf(
  cdp: CDPSession,
  sleep: (ms: number) => Promise<void>,
): Promise<number | null> {
  for (let attempt = 1; attempt <= HISTORY_READ_ATTEMPTS; attempt += 1) {
    try {
      const history = await cdp.send('Page.getNavigationHistory');
      return history.currentIndex;
    } catch {
      if (attempt < HISTORY_READ_ATTEMPTS) await sleep(HISTORY_READ_RETRY_MS);
    }
  }
  return null;
}

/**
 * Classifies main frame navigations from Node, over CDP only: the type comes
 * from `Page.frameStartedNavigating` (reload, history traversal, ordinary
 * navigation) and the history index from `Page.getNavigationHistory` once the
 * navigation committed. Nothing runs in the page.
 */
export async function trackNavigation(
  cdp: CDPSession,
  deps: Deps,
): Promise<void> {
  await cdp.send('Page.enable');
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const mainFrameId = frameTree.frame.id;
  let announced: string | undefined;

  const sleep = deps.sleep ?? realSleep;
  // One history read at a time: a retried read must not let a later
  // navigation be reported before the one that committed first.
  let previous: Promise<void> = Promise.resolve();
  const report = (url: string, navigationType: NavigationType): void => {
    if (NOT_REPORTED.test(url)) return;
    const receivedAt = deps.now();
    const reported = previous.then(async () => {
      const entryIndex = await entryIndexOf(cdp, sleep);
      deps.onNavigation({ url, navigationType, entryIndex, receivedAt });
    });
    previous = reported.catch(() => undefined);
  };
  const takeAnnounced = (): string | undefined => {
    const type = announced;
    announced = undefined;
    return type;
  };

  cdp.on(
    'Page.frameStartedNavigating',
    (event: Started & { frameId: string }) => {
      if (event.frameId === mainFrameId) announced = event.navigationType;
    },
  );
  cdp.on('Page.frameNavigated', (event: Navigated) => {
    if (event.frame.parentId !== undefined) return;
    report(event.frame.url, navigationTypeOf(takeAnnounced()));
  });
  cdp.on('Page.navigatedWithinDocument', (event: WithinDocument) => {
    if (event.frameId !== mainFrameId) return;
    report(event.url, navigationTypeOf(takeAnnounced(), event.navigationType));
  });
}
