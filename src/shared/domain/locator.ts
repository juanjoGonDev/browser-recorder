/** How an element is found again at replay time, most stable kind first. */
export type Locator =
  | { readonly kind: 'test-id'; readonly testId: string }
  | { readonly kind: 'role'; readonly role: string; readonly name: string }
  | { readonly kind: 'label' | 'placeholder' | 'text'; readonly text: string }
  | { readonly kind: 'css'; readonly selector: string };

/** An element an event acted on, with enough context to find it in a frame. */
export interface Target {
  readonly locator: Locator;
  /** Index among the elements the locator matched, `null` when it is unique. */
  readonly nth: number | null;
  /** Iframe CSS selectors, outermost first. Empty for the main frame. */
  readonly framePath: readonly string[];
  /** Human readable label shown in the timeline. */
  readonly description: string;
}
