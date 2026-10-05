/** One element the pointer entered since the previous recorded action. */
export interface HoverEntry<T> {
  readonly element: T;
  readonly enteredAtMs: number;
  /** DOM depth; smaller is closer to the document root. */
  readonly depth: number;
  /** Strictly contains the click target. The target itself is not traced. */
  readonly isAncestorOfTarget: boolean;
  /** `html` or `body`: never worth replaying a hover on. */
  readonly isRoot: boolean;
  /** The DOM mutated while the pointer was over this element. */
  readonly didMutate: boolean;
}

export interface HoverTarget<T> {
  readonly element: T;
  /** Milliseconds between entering the element and `nowMs`. */
  readonly ageMs: number;
}

function outermostAncestor<T>(
  trace: readonly HoverEntry<T>[],
): HoverEntry<T> | null {
  let outermost: HoverEntry<T> | null = null;
  for (const entry of trace) {
    if (!entry.isAncestorOfTarget || entry.isRoot) continue;
    if (outermost === null || entry.depth < outermost.depth) outermost = entry;
  }
  return outermost;
}

function lastMutatingNonAncestor<T>(
  trace: readonly HoverEntry<T>[],
): HoverEntry<T> | null {
  let last: HoverEntry<T> | null = null;
  for (const entry of trace) {
    if (entry.isAncestorOfTarget || entry.isRoot || !entry.didMutate) continue;
    if (last === null || entry.enteredAtMs >= last.enteredAtMs) last = entry;
  }
  return last;
}

/**
 * The hovers to record before a click: the outermost entered ancestor of the
 * target (CSS `:hover` menus) and the last entered non-ancestor during whose
 * hover the DOM mutated (JavaScript popovers). Ordered by enter time.
 */
export function selectHoverTargets<T>(
  trace: readonly HoverEntry<T>[],
  nowMs: number,
): readonly HoverTarget<T>[] {
  const selected = [
    outermostAncestor(trace),
    lastMutatingNonAncestor(trace),
  ].filter((entry): entry is HoverEntry<T> => entry !== null);
  return selected
    .sort((left, right) => left.enteredAtMs - right.enteredAtMs)
    .map((entry) => ({
      element: entry.element,
      ageMs: Math.max(0, nowMs - entry.enteredAtMs),
    }));
}
