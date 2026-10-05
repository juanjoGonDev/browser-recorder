const OBSERVED: MutationObserverInit = { childList: true, subtree: true };

/**
 * Calls `onRoot` once for every open shadow root: those that exist now, those
 * that are created with new elements (observed through mutations), and those
 * attached to an element that was already there, which no mutation reveals;
 * `watchPath` finds those when the user acts on or inside them. Closed roots
 * are invisible to a page-side script, so they are never reported.
 */
export function watchShadowRoots(onRoot: (root: ShadowRoot) => void): {
  /** Registers the shadow roots an event passed through on its way. */
  watchPath(event: Event): void;
} {
  const known = new WeakSet<ShadowRoot>();

  function register(root: ShadowRoot): void {
    if (known.has(root)) return;
    known.add(root);
    onRoot(root);
    observe(root);
    visit(root);
  }

  function visitHost(element: Element): void {
    if (element.shadowRoot !== null) register(element.shadowRoot);
  }

  function visit(parent: ParentNode): void {
    for (const element of parent.querySelectorAll('*')) visitHost(element);
  }

  function observe(parent: Node): void {
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          visitHost(node);
          visit(node);
        }
      }
    }).observe(parent, OBSERVED);
  }

  observe(document);
  visit(document);
  return {
    watchPath(event) {
      for (const node of event.composedPath()) {
        if (node instanceof ShadowRoot) register(node);
      }
    },
  };
}
