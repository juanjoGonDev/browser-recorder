import type {
  FrameLocator,
  Locator as PlaywrightLocator,
  Page,
} from 'patchright';
import type { Locator } from '../../shared/domain/locator.ts';

const VERIFY_TIMEOUT_MS = 150;

type RoleOptions = Parameters<Page['getByRole']>[0];

/** Where locators are built: a page, or an iframe inside it. */
export type LocatorScope = Pick<
  Page,
  | 'getByTestId'
  | 'getByRole'
  | 'getByLabel'
  | 'getByPlaceholder'
  | 'getByText'
  | 'locator'
>;

/** The Playwright locator a replay script will build for this locator. */
export function toPlaywrightLocator(
  frame: LocatorScope,
  locator: Locator,
): PlaywrightLocator {
  switch (locator.kind) {
    case 'test-id':
      return frame.getByTestId(locator.testId);
    case 'role':
      return frame.getByRole(locator.role as RoleOptions, {
        name: locator.name,
        exact: true,
      });
    case 'label':
      return frame.getByLabel(locator.text, { exact: true });
    case 'placeholder':
      return frame.getByPlaceholder(locator.text, { exact: true });
    case 'text':
      return frame.getByText(locator.text, { exact: true });
    case 'css':
      return frame.locator(locator.selector);
  }
}

type CountOf = (candidate: Locator) => Promise<number>;

function timeoutAfter(ms: number): {
  promise: Promise<null>;
  cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null);
    }, ms);
  });
  return {
    promise,
    cancel: () => {
      clearTimeout(timer);
    },
  };
}

async function firstUnique(
  candidates: readonly Locator[],
  countOf: CountOf,
): Promise<Locator | null> {
  for (const candidate of candidates) {
    if ((await countOf(candidate)) === 1) return candidate;
  }
  return null;
}

/**
 * Puts the first candidate Playwright finds exactly once at the front. The
 * in-page ranking is an approximation of Playwright's own engine, so it is
 * checked against the real one, within `timeoutMs` for all candidates. When
 * nothing verifies, or the page is gone, the in-page order stands.
 */
export async function orderByVerification(
  candidates: readonly Locator[],
  countOf: CountOf,
  timeoutMs: number = VERIFY_TIMEOUT_MS,
): Promise<readonly Locator[]> {
  const timeout = timeoutAfter(timeoutMs);
  try {
    const verified = await Promise.race([
      firstUnique(candidates, countOf),
      timeout.promise,
    ]);
    if (verified === null) return candidates;
    return [
      verified,
      ...candidates.filter((candidate) => candidate !== verified),
    ];
  } catch {
    return candidates;
  } finally {
    timeout.cancel();
  }
}

/** The scope of a frame: the page narrowed by each iframe selector in turn. */
export function scopeOfFrame(
  page: Page,
  framePath: readonly string[],
): LocatorScope {
  let scope: Page | FrameLocator = page;
  for (const selector of framePath) scope = scope.frameLocator(selector);
  return scope;
}

/** `orderByVerification` against the frame the event happened in. */
export function verifyInScope(
  scope: LocatorScope,
  candidates: readonly Locator[],
): Promise<readonly Locator[]> {
  return orderByVerification(candidates, (candidate) =>
    toPlaywrightLocator(scope, candidate).count(),
  );
}
