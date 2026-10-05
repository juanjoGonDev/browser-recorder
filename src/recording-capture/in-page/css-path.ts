import { filterStableClasses } from '../domain/filter-stable-classes.ts';
import { isDynamicId } from '../domain/is-dynamic-id.ts';
import { deepQueryAll } from './deep-query.ts';

const IDENTIFYING_ATTRIBUTES = ['name', 'type', 'role', 'aria-label'];
const MAX_CLASSES = 2;

function quote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`)}"`;
}

/** `#id`, but only when the id is not generated and no other element has it. */
function uniqueStableId(element: Element): string | null {
  const { id } = element;
  if (id === '' || isDynamicId(id)) return null;
  const selector = `#${CSS.escape(id)}`;
  return isUnique(selector) ? selector : null;
}

/** Tag, identifying attributes and stable classes: no position yet. */
function describeSegment(element: Element): string {
  const attributes = IDENTIFYING_ATTRIBUTES.flatMap((name) => {
    const value = element.getAttribute(name);
    return value === null || value === '' ? [] : [`[${name}=${quote(value)}]`];
  });
  const classes = filterStableClasses([...element.classList])
    .slice(0, MAX_CLASSES)
    .map((name) => `.${CSS.escape(name)}`);
  return [element.tagName.toLowerCase(), ...attributes, ...classes].join('');
}

function siblingsOf(element: Element): Element[] {
  const parent = element.parentNode;
  return parent === null
    ? []
    : [...parent.children].filter((child) => child.tagName === element.tagName);
}

/** The segment, with `:nth-of-type` only if siblings match it as well. */
function segmentOf(element: Element): string {
  const segment = describeSegment(element);
  const twins = siblingsOf(element).filter((sibling) =>
    sibling.matches(segment),
  );
  if (twins.length < 2) return segment;
  const position = siblingsOf(element).indexOf(element) + 1;
  return `${segment}:nth-of-type(${String(position)})`;
}

function isUnique(selector: string): boolean {
  return deepQueryAll(selector).length === 1;
}

/** Climbs until the chain is unique; stops at the root of the element's tree. */
function chainWithinTree(element: Element): string[] {
  const chain: string[] = [];
  let current: Element | null = element;
  while (current !== null) {
    const anchor = uniqueStableId(current);
    chain.unshift(anchor ?? segmentOf(current));
    if (anchor !== null || isUnique(chain.join(' > '))) break;
    current = current.parentElement;
  }
  return chain;
}

/**
 * A stable CSS selector for the element. Inside a shadow root the chain is
 * relative to that root; if it is not unique there, the host's path is
 * prepended with a descendant combinator, which Playwright pierces.
 */
export function cssPath(element: Element): string {
  const chain = chainWithinTree(element).join(' > ');
  const root = element.getRootNode();
  if (isUnique(chain) || !(root instanceof ShadowRoot)) return chain;
  return `${cssPath(root.host)} ${chain}`;
}
