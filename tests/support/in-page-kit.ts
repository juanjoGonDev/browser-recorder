// Bundled by tests/support/in-page-probe.ts and loaded into real Chromium so
// the in-page DOM helpers can be called against fixture markup.
import { accessibleName } from '../../src/recording-capture/in-page/accessible-name.ts';
import { buildCandidates } from '../../src/recording-capture/in-page/build-locator.ts';
import { cssPath } from '../../src/recording-capture/in-page/css-path.ts';
import { describeElement } from '../../src/recording-capture/in-page/describe-element.ts';
import {
  deepContains,
  deepQueryAll,
  parentOf,
} from '../../src/recording-capture/in-page/deep-query.ts';
import { implicitRole } from '../../src/recording-capture/in-page/implicit-role.ts';

const ELEMENT_FUNCTIONS = {
  accessibleName,
  buildCandidates,
  cssPath,
  describeElement,
  implicitRole,
} as const;

export type ElementFunction = keyof typeof ELEMENT_FUNCTIONS;

function find(selector: string): Element {
  const element = deepQueryAll(selector).at(0);
  if (element === undefined) throw new Error(`no element for ${selector}`);
  return element;
}

/** Calls one in-page helper on the first element the selector reaches. */
export function probe(name: ElementFunction, selector: string): unknown {
  return ELEMENT_FUNCTIONS[name](find(selector));
}

/** The id of the parent of the element, crossing shadow boundaries. */
export function parentTag(selector: string): string | null {
  return parentOf(find(selector))?.tagName.toLowerCase() ?? null;
}

export function containsDeep(outer: string, inner: string): boolean {
  return deepContains(find(outer), find(inner));
}

export { deepQueryAll };
