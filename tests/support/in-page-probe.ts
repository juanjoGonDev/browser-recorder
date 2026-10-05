import type { Page } from 'patchright';
import type * as InPageKit from './in-page-kit.ts';
import type { ElementFunction } from './in-page-kit.ts';
import { loadModule } from './bundle-in-page-module.ts';

// Patchright evaluates in an isolated world unless told otherwise; the kit is
// installed in the page's own world, so the probes must look there.
const isMainWorld = false;

type KitWindow = typeof globalThis & { inPageKit: typeof InPageKit };

/** Puts the in-page helpers into a page so `probe` and friends can call them. */
export function loadKit(page: Page): Promise<void> {
  return loadModule(page, 'tests/support/in-page-kit.ts');
}

/** Runs one in-page helper on the first element the selector reaches. */
export function probe(
  page: Page,
  name: ElementFunction,
  selector: string,
): Promise<unknown> {
  return page.evaluate(
    ([fn, sel]) => (window as unknown as KitWindow).inPageKit.probe(fn, sel),
    [name, selector] as const,
    undefined,
    isMainWorld,
  );
}

/** How many elements the shadow-piercing query reaches for the selector. */
export function deepCount(page: Page, selector: string): Promise<number> {
  return page.evaluate(
    (sel) =>
      (window as unknown as KitWindow).inPageKit.deepQueryAll(sel).length,
    selector,
    undefined,
    isMainWorld,
  );
}

export function parentTagOf(
  page: Page,
  selector: string,
): Promise<string | null> {
  return page.evaluate(
    (sel) => (window as unknown as KitWindow).inPageKit.parentTag(sel),
    selector,
    undefined,
    isMainWorld,
  );
}

export function containsDeep(
  page: Page,
  outer: string,
  inner: string,
): Promise<boolean> {
  return page.evaluate(
    ([a, b]) => (window as unknown as KitWindow).inPageKit.containsDeep(a, b),
    [outer, inner] as const,
    undefined,
    isMainWorld,
  );
}
