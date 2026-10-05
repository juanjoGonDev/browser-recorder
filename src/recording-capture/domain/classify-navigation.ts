export type NavigationType =
  | 'navigate'
  | 'reload'
  | 'back_forward'
  | 'push'
  | 'replace'
  | 'traverse'
  | 'unknown';

export interface NavigationInput {
  readonly navigationType: NavigationType;
  readonly url: string;
  /** Position in the history entries list, `null` when unknown. */
  readonly entryIndex: number | null;
  readonly nowMs: number;
}

/** What the session already knows about the page before this navigation. */
export interface NavigationHistory {
  /** Last user action on any page, `null` before the first one. */
  readonly lastActionAtMs: number | null;
  /** Previous navigation of this same page. */
  readonly lastNavigationAtMs: number | null;
  readonly currentUrl: string | null;
  readonly previousEntryIndex: number | null;
}

export type NavigationStep =
  | { readonly kind: 'goto' | 'wait-for-url'; readonly url: string }
  | { readonly kind: 'reload' | 'go-back' | 'go-forward' };

/** A navigation this soon after an action was caused by the action. */
const ACTION_WINDOW_MS = 1000;
/** A navigation this soon after another one on the same page is a redirect. */
const REDIRECT_WINDOW_MS = 1500;

export function isActionRecent(
  lastActionAtMs: number | null,
  nowMs: number,
): boolean {
  return lastActionAtMs !== null && nowMs - lastActionAtMs < ACTION_WINDOW_MS;
}

export function classifyPageOpenCause(
  lastActionAtMs: number | null,
  nowMs: number,
): 'action' | 'user' {
  return isActionRecent(lastActionAtMs, nowMs) ? 'action' : 'user';
}

function isRedirect(history: NavigationHistory, nowMs: number): boolean {
  const { lastNavigationAtMs, lastActionAtMs } = history;
  if (lastNavigationAtMs === null) return false;
  const hasActionSince =
    lastActionAtMs !== null && lastActionAtMs > lastNavigationAtMs;
  return nowMs - lastNavigationAtMs < REDIRECT_WINDOW_MS && !hasActionSince;
}

function historySteps(
  input: NavigationInput,
  history: NavigationHistory,
): readonly NavigationStep[] {
  const { entryIndex } = input;
  const { previousEntryIndex } = history;
  const delta =
    entryIndex === null || previousEntryIndex === null
      ? 0
      : entryIndex - previousEntryIndex;
  if (delta === 0) return [{ kind: 'goto', url: input.url }];
  const kind = delta < 0 ? 'go-back' : 'go-forward';
  return Array.from({ length: Math.abs(delta) }, () => ({ kind }));
}

function documentSteps(
  input: NavigationInput,
  history: NavigationHistory,
): readonly NavigationStep[] {
  const isCaused =
    isActionRecent(history.lastActionAtMs, input.nowMs) ||
    isRedirect(history, input.nowMs);
  if (isCaused) return [{ kind: 'wait-for-url', url: input.url }];
  const isSameDocument =
    input.navigationType === 'push' || input.navigationType === 'replace';
  if (isSameDocument && input.url === history.currentUrl) return [];
  return [{ kind: 'goto', url: input.url }];
}

/**
 * The replay steps one main-frame navigation stands for. An empty list means
 * the navigation carries no information of its own and is dropped.
 */
export function classifyNavigation(
  input: NavigationInput,
  history: NavigationHistory,
): readonly NavigationStep[] {
  if (input.navigationType === 'reload') return [{ kind: 'reload' }];
  const isHistoryMove =
    input.navigationType === 'back_forward' ||
    input.navigationType === 'traverse';
  return isHistoryMove
    ? historySteps(input, history)
    : documentSteps(input, history);
}
