/** The document plus every open shadow root reachable from it. */
export function deepRoots(): ParentNode[] {
  const roots: ParentNode[] = [document];
  // `for...of` over a growing array also visits the roots pushed inside it.
  for (const root of roots) {
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot !== null) roots.push(element.shadowRoot);
    }
  }
  return roots;
}

/** `querySelectorAll` that also pierces open shadow roots. */
export function deepQueryAll(selector: string): Element[] {
  return deepRoots().flatMap((root) => [...root.querySelectorAll(selector)]);
}

/** The parent element, stepping from a shadow root to its host. */
export function parentOf(element: Element): Element | null {
  if (element.parentElement !== null) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/** Whether `node` is `ancestor` or sits below it, across shadow boundaries. */
export function deepContains(ancestor: Element, node: Element | null): boolean {
  for (let current = node; current !== null; current = parentOf(current)) {
    if (current === ancestor) return true;
  }
  return false;
}

/** The focused element, looking inside shadow roots. */
export function deepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/** The element an event really came from, even through a shadow boundary. */
export function originOf(event: Event): Element | null {
  const [first] = event.composedPath();
  return first instanceof Element ? first : null;
}
