import type { Target } from './locator.ts';

export type PageId = `page${number}`;
export type Modifier = 'Alt' | 'Control' | 'Meta' | 'Shift';
export type DialogType = 'alert' | 'confirm' | 'prompt' | 'beforeunload';

interface Base<K extends string> {
  readonly kind: K;
  /** Milliseconds from session start, non-decreasing across events. */
  readonly offsetMs: number;
  readonly pageId: PageId;
}

/** One recorded user action. The order of the array is the replay order. */
export type RecordingEvent =
  | (Base<'goto'> & { readonly url: string })
  // Matched on origin and pathname only.
  | (Base<'wait-for-url'> & { readonly url: string })
  | Base<'reload'>
  | Base<'go-back'>
  | Base<'go-forward'>
  | Base<'page-closed'>
  | (Base<'click'> & {
      readonly target: Target;
      readonly button: 'left' | 'middle' | 'right';
      readonly modifiers: readonly Modifier[];
    })
  | (Base<'dblclick'> & {
      readonly target: Target;
      readonly modifiers: readonly Modifier[];
    })
  | (Base<'hover'> & { readonly target: Target })
  | (Base<'check'> & { readonly target: Target; readonly checked: boolean })
  | (Base<'fill'> & {
      readonly target: Target;
      readonly value: string;
      readonly isSensitive: boolean;
    })
  | (Base<'select-option'> & {
      readonly target: Target;
      readonly values: readonly string[];
    })
  // `key` is canonical, e.g. 'Control+Shift+K'.
  | (Base<'press'> & { readonly target: Target | null; readonly key: string })
  | (Base<'scroll'> & {
      readonly target: Target | null;
      readonly x: number;
      readonly y: number;
    })
  | (Base<'drag-and-drop'> & {
      readonly source: Target;
      readonly target: Target;
    })
  | (Base<'set-input-files'> & { readonly fileNames: readonly string[] })
  | (Base<'dialog'> & {
      readonly dialogType: DialogType;
      readonly message: string;
      readonly action: 'accept' | 'dismiss';
      readonly promptText: string | null;
    })
  | (Base<'page-opened'> & {
      readonly openerPageId: PageId | null;
      readonly cause: 'action' | 'user';
      readonly url: string;
    });

export type RecordingEventKind = RecordingEvent['kind'];
