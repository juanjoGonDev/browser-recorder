import type { CDPSession } from 'playwright';
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
}

async function entryIndexOf(cdp: CDPSession): Promise<number | null> {
  try {
    const history = await cdp.send('Page.getNavigationHistory');
    return history.currentIndex;
  } catch {
    return null;
  }
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

  const report = async (
    url: string,
    navigationType: NavigationType,
  ): Promise<void> => {
    if (NOT_REPORTED.test(url)) return;
    const receivedAt = deps.now();
    const entryIndex = await entryIndexOf(cdp);
    deps.onNavigation({ url, navigationType, entryIndex, receivedAt });
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
    void report(event.frame.url, navigationTypeOf(takeAnnounced()));
  });
  cdp.on('Page.navigatedWithinDocument', (event: WithinDocument) => {
    if (event.frameId !== mainFrameId) return;
    void report(
      event.url,
      navigationTypeOf(takeAnnounced(), event.navigationType),
    );
  });
}
