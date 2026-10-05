import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import { createPageIds } from '../../../src/recording-capture/adapters/page-ids.ts';

function fakePage(): Page {
  return {} as unknown as Page;
}

describe('src/recording-capture/adapters/page-ids.ts', () => {
  it('numbers pages in the order they are first seen and remembers them', () => {
    const ids = createPageIds();
    const first = fakePage();
    const second = fakePage();
    expect(ids.idOf(first)).toBe('page1');
    expect(ids.idOf(second)).toBe('page2');
    expect(ids.idOf(first)).toBe('page1');
  });

  it('tells a page it has seen from one it has not, without numbering it', () => {
    const ids = createPageIds();
    const seen = fakePage();
    const stranger = fakePage();
    ids.idOf(seen);
    expect(ids.knownIdOf(seen)).toBe('page1');
    expect(ids.knownIdOf(stranger)).toBeNull();
    expect(ids.idOf(stranger)).toBe('page2');
  });
});
