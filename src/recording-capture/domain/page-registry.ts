import type { PageId } from '../../shared/domain/recording-event.ts';

interface PageRecord {
  readonly openerPageId: PageId | null;
  readonly isOpen: boolean;
}

/** The pages of one session, keyed by the `page1..n` ids the adapter assigns. */
export type PageRegistry = ReadonlyMap<PageId, PageRecord>;

const FIRST_PAGE_ID: PageId = 'page1';

/** A session always starts with its first page open. */
export function createPageRegistry(): PageRegistry {
  return new Map([[FIRST_PAGE_ID, { openerPageId: null, isOpen: true }]]);
}

/** Records a new tab. A page that is already known keeps its state. */
export function registerPage(
  registry: PageRegistry,
  pageId: PageId,
  openerPageId: PageId | null,
): PageRegistry {
  if (registry.has(pageId)) return registry;
  return new Map([...registry, [pageId, { openerPageId, isOpen: true }]]);
}

export function closePage(
  registry: PageRegistry,
  pageId: PageId,
): PageRegistry {
  const record = registry.get(pageId);
  if (record === undefined) return registry;
  return new Map([...registry, [pageId, { ...record, isOpen: false }]]);
}

export function isPageOpen(registry: PageRegistry, pageId: PageId): boolean {
  return registry.get(pageId)?.isOpen === true;
}

export function openerOf(
  registry: PageRegistry,
  pageId: PageId,
): PageId | null {
  return registry.get(pageId)?.openerPageId ?? null;
}

export function hasOpenPages(registry: PageRegistry): boolean {
  return [...registry.values()].some((record) => record.isOpen);
}
