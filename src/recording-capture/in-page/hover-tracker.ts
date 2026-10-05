import { selectHoverTargets } from '../domain/select-hover-targets.ts';
import type { HoverEntry } from '../domain/select-hover-targets.ts';
import { deepContains, originOf, parentOf } from './deep-query.ts';
import { afterEmit, emitDom } from './emit.ts';
import { listen } from './listen.ts';

interface TracedElement {
  readonly element: Element;
  readonly enteredAtMs: number;
  readonly depth: number;
  didMutate: boolean;
}

// A page left hovering for hours must not grow the trace without bound.
const MAX_TRACE_LENGTH = 200;
const ROOT_TAGS = new Set(['HTML', 'BODY']);
let trace: TracedElement[] = [];
let hovered = new Set<Element>();

function ancestorChain(origin: Element): Element[] {
  const chain: Element[] = [];
  for (
    let current: Element | null = origin;
    current !== null;
    current = parentOf(current)
  ) {
    chain.push(current);
  }
  return chain;
}

function onPointerOver(event: PointerEvent): void {
  const origin = originOf(event);
  if (origin === null) return;
  const chain = ancestorChain(origin);
  const now = performance.now();
  // Entered elements, outermost first, so enter times follow the DOM order.
  const entered = chain.filter((element) => !hovered.has(element)).reverse();
  for (const element of entered) {
    const depth = chain.length - 1 - chain.indexOf(element);
    trace.push({ element, enteredAtMs: now, depth, didMutate: false });
  }
  trace = trace.slice(-MAX_TRACE_LENGTH);
  hovered = new Set(chain);
}

function onMutation(): void {
  for (const entry of trace) {
    if (hovered.has(entry.element)) entry.didMutate = true;
  }
}

function toHoverEntries(target: Element): HoverEntry<Element>[] {
  return trace
    .filter(
      ({ element }) =>
        element.isConnected &&
        element !== target &&
        !deepContains(target, element),
    )
    .map((entry) => ({
      element: entry.element,
      enteredAtMs: entry.enteredAtMs,
      depth: entry.depth,
      isAncestorOfTarget: deepContains(entry.element, target),
      isRoot: ROOT_TAGS.has(entry.element.tagName),
      didMutate: entry.didMutate,
    }));
}

/**
 * Reports the hovers that revealed `target` (see `selectHoverTargets`),
 * dated to when the pointer entered them, and starts a fresh trace.
 */
export function emitHoverTargets(target: Element): void {
  const selected = selectHoverTargets(
    toHoverEntries(target),
    performance.now(),
  );
  trace = [];
  for (const { element, ageMs } of selected) {
    emitDom(element, { kind: 'hover' }, ageMs);
  }
}

export function installHoverTracker(): void {
  listen('pointerover', onPointerOver);
  new MutationObserver(onMutation).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  // Any other recorded action ends the window the hovers belong to.
  afterEmit((message) => {
    if (message.kind !== 'dom' || message.payload.kind !== 'hover') trace = [];
  });
}
