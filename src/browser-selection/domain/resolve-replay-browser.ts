import type {
  BrowserChoice,
  BrowserId,
} from '../../shared/domain/browser-choice.ts';

/** Which browser a replay uses: the recorded one, or the bundled fallback. */
export type ReplayBrowser =
  | { readonly kind: 'as-recorded'; readonly choice: BrowserChoice }
  | {
      readonly kind: 'fallback';
      readonly choice: BrowserChoice;
      readonly missing: BrowserId;
    };
