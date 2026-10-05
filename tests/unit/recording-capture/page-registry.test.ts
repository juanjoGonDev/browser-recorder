import { describe, expect, it } from 'vitest';
import {
  closePage,
  createPageRegistry,
  hasOpenPages,
  isPageOpen,
  openerOf,
  registerPage,
} from '../../../src/recording-capture/domain/page-registry.ts';

describe('src/recording-capture/domain/page-registry.ts', () => {
  it('starts with the first page open and no opener', () => {
    const registry = createPageRegistry();
    expect(isPageOpen(registry, 'page1')).toBe(true);
    expect(openerOf(registry, 'page1')).toBeNull();
    expect(hasOpenPages(registry)).toBe(true);
  });

  it('tracks the opener of a new tab', () => {
    const registry = registerPage(createPageRegistry(), 'page2', 'page1');
    expect(isPageOpen(registry, 'page2')).toBe(true);
    expect(openerOf(registry, 'page2')).toBe('page1');
  });

  it('records a tab opened by the user with no opener', () => {
    const registry = registerPage(createPageRegistry(), 'page2', null);
    expect(openerOf(registry, 'page2')).toBeNull();
    expect(isPageOpen(registry, 'page2')).toBe(true);
  });

  it('keeps registering the same page idempotent', () => {
    const once = registerPage(createPageRegistry(), 'page2', 'page1');
    const twice = registerPage(once, 'page2', 'page1');
    expect(twice).toEqual(once);
  });

  it('closes one page and keeps the others open', () => {
    const opened = registerPage(createPageRegistry(), 'page2', 'page1');
    const closed = closePage(opened, 'page2');
    expect(isPageOpen(closed, 'page2')).toBe(false);
    expect(isPageOpen(closed, 'page1')).toBe(true);
    expect(hasOpenPages(closed)).toBe(true);
  });

  it('has no open pages once every page is closed', () => {
    const opened = registerPage(createPageRegistry(), 'page2', 'page1');
    const closed = closePage(closePage(opened, 'page1'), 'page2');
    expect(hasOpenPages(closed)).toBe(false);
  });

  it('does not change the original registry', () => {
    const original = createPageRegistry();
    closePage(original, 'page1');
    expect(isPageOpen(original, 'page1')).toBe(true);
  });

  it('does not reopen a page that was closed', () => {
    const closed = closePage(createPageRegistry(), 'page1');
    expect(isPageOpen(registerPage(closed, 'page1', null), 'page1')).toBe(
      false,
    );
  });
});
