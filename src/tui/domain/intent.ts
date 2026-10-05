export type TextEdit =
  | { readonly kind: 'insert'; readonly text: string }
  | { readonly kind: 'backspace' }
  | { readonly kind: 'clear-line' }
  | { readonly kind: 'move'; readonly direction: 'left' | 'right' };

export type MenuTarget = 'main-menu' | 'library' | 'new-recording';

/**
 * What a key press means on the current screen. `keymap(state, key)` returns
 * one (or `null`); the controller executes it against `AppServices` and
 * dispatches the resulting `AppAction`s. Pure state changes (moving a
 * selection, editing text) are reduced directly.
 */
export type Intent =
  | { readonly kind: 'quit' }
  | { readonly kind: 'retry-setup' }
  | { readonly kind: 'open'; readonly target: MenuTarget }
  | { readonly kind: 'move-selection'; readonly delta: number }
  | { readonly kind: 'page-selection'; readonly direction: 'up' | 'down' }
  | { readonly kind: 'activate' }
  | { readonly kind: 'switch-field' }
  | { readonly kind: 'cycle-option'; readonly delta: number }
  | { readonly kind: 'edit-text'; readonly edit: TextEdit }
  | { readonly kind: 'submit' }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'stop-recording' }
  | { readonly kind: 'request-discard' }
  | { readonly kind: 'answer-confirm'; readonly isYes: boolean }
  | {
      readonly kind: 'respond-dialog';
      readonly action: 'accept' | 'dismiss';
    }
  | { readonly kind: 'replay-selected' }
  | { readonly kind: 'show-timeline' }
  | { readonly kind: 'begin-rename' }
  | { readonly kind: 'begin-delete' }
  | { readonly kind: 'cancel-replay' };
