import type { Page } from 'patchright';
import type { PageId } from '../../shared/domain/recording-event.ts';

export interface PageIds {
  /** The stable id of a page, assigned `page1`, `page2`... on first sight. */
  idOf(page: Page): PageId;
  /** The id of a page already seen, `null` for one that never was. */
  knownIdOf(page: Page): PageId | null;
}

export function createPageIds(): PageIds {
  const ids = new WeakMap<Page, PageId>();
  let count = 0;
  const idOf = (page: Page): PageId => {
    const known = ids.get(page);
    if (known !== undefined) return known;
    count += 1;
    const created = `page${count}` as const;
    ids.set(page, created);
    return created;
  };
  return { idOf, knownIdOf: (page) => ids.get(page) ?? null };
}
