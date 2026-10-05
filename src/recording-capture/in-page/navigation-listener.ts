import type { InPageMessage } from '../domain/in-page-message.ts';
import { emit } from './emit.ts';

type NavigationType = Extract<
  InPageMessage,
  { kind: 'navigation' }
>['navigationType'];

// The Navigation API is not in every TypeScript DOM lib yet, and not in every
// browser: it is read defensively and its absence only costs the entry index.
interface NavigationApi extends EventTarget {
  readonly currentEntry: { readonly index: number } | null;
}
interface EntryChange extends Event {
  readonly navigationType: string | null;
}

const LOAD_TYPES = new Set(['navigate', 'reload', 'back_forward']);
const ENTRY_TYPES = new Set(['push', 'replace', 'traverse', 'reload']);

function navigationApi(): NavigationApi | null {
  const api = (window as unknown as { navigation?: NavigationApi }).navigation;
  return api ?? null;
}

function entryIndex(): number | null {
  return navigationApi()?.currentEntry?.index ?? null;
}

function loadType(): NavigationType {
  const [entry] = performance.getEntriesByType('navigation');
  const type = (entry as PerformanceNavigationTiming | undefined)?.type;
  return type !== undefined && LOAD_TYPES.has(type) ? type : 'navigate';
}

function report(navigationType: NavigationType): boolean {
  return emit({
    kind: 'navigation',
    url: location.href,
    navigationType,
    entryIndex: entryIndex(),
  });
}

function onEntryChange(event: Event): void {
  const { navigationType } = event as EntryChange;
  const type = navigationType ?? 'unknown';
  report(ENTRY_TYPES.has(type) ? (type as NavigationType) : 'unknown');
}

/** Reports the document load; the binding can lag, so it retries once. */
function reportDocumentStart(): void {
  if (report(loadType())) return;
  document.addEventListener('DOMContentLoaded', () => report(loadType()), {
    once: true,
  });
}

/** Main frame only: iframes navigate without the user having gone anywhere. */
export function installNavigationListener(): void {
  if (window !== window.top || location.protocol === 'about:') return;
  reportDocumentStart();
  navigationApi()?.addEventListener('currententrychange', onEntryChange);
}
