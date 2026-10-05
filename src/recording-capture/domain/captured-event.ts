import type { Locator } from '../../shared/domain/locator.ts';
import type { Modifier } from '../../shared/domain/recording-event.ts';

/**
 * The in-page to Node protocol: what the capture script reports about one
 * trusted DOM interaction. It carries no offset; Node stamps it on receipt
 * and uses `ageMs` to place events that happened earlier than the report
 * (hover enter, debounced scroll).
 *
 * The element the event acted on travels beside the payload as ranked
 * `candidates` (see `SessionSignal`); an empty list means the event has no
 * element target (a key pressed on the page, a window scroll).
 */
interface Timed {
  /** Milliseconds between the real moment and the moment of the report. */
  readonly ageMs: number;
  /** Timeline label of the target element, empty when there is none. */
  readonly description: string;
}

export type CapturedEvent =
  | (Timed & {
      readonly kind: 'click';
      readonly button: 'left' | 'middle' | 'right';
      readonly modifiers: readonly Modifier[];
    })
  | (Timed & {
      readonly kind: 'dblclick';
      readonly modifiers: readonly Modifier[];
    })
  | (Timed & { readonly kind: 'hover' })
  | (Timed & {
      readonly kind: 'input';
      readonly value: string;
      readonly isSensitive: boolean;
    })
  | (Timed & { readonly kind: 'select'; readonly values: readonly string[] })
  | (Timed & { readonly kind: 'check'; readonly checked: boolean })
  | (Timed & { readonly kind: 'files'; readonly fileNames: readonly string[] })
  | (Timed & { readonly kind: 'key'; readonly key: string })
  | (Timed & {
      readonly kind: 'scroll';
      readonly x: number;
      readonly y: number;
    })
  // The signal's candidates describe the drop target; the dragged element is
  // always in the same frame and travels here.
  | (Timed & {
      readonly kind: 'drag';
      readonly source: {
        readonly candidates: readonly Locator[];
        readonly description: string;
      };
    });
