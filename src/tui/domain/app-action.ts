import type { Recording } from '../../shared/domain/recording.ts';
import type {
  BrowserOptionView,
  LibraryEntryView,
  RecordingUpdateView,
  ReplayView,
} from './app-views.ts';
import type { MenuTarget, TextEdit } from './intent.ts';

/** Every state change goes through one of these; the reducer is pure. */
export type AppAction =
  | { readonly type: 'tick'; readonly nowMs: number }
  | { readonly type: 'resize'; readonly listRows: number }
  | { readonly type: 'setup-output'; readonly line: string }
  | { readonly type: 'setup-installing' }
  | { readonly type: 'setup-ready'; readonly linuxHint: string | null }
  | {
      readonly type: 'setup-failed';
      readonly manualCommand: string;
      readonly exitCode: number | null;
    }
  | { readonly type: 'navigate'; readonly target: MenuTarget }
  | { readonly type: 'move-selection'; readonly delta: number }
  | { readonly type: 'page-selection'; readonly direction: 'up' | 'down' }
  | { readonly type: 'switch-field' }
  | { readonly type: 'cycle-option'; readonly delta: number }
  | {
      readonly type: 'browsers-loaded';
      readonly browsers: readonly BrowserOptionView[];
    }
  | { readonly type: 'browsers-failed'; readonly message: string }
  | { readonly type: 'edit-text'; readonly edit: TextEdit }
  | { readonly type: 'form-error'; readonly message: string | null }
  | { readonly type: 'recording-started'; readonly name: string }
  | { readonly type: 'recording-updated'; readonly update: RecordingUpdateView }
  | { readonly type: 'recording-stopping' }
  | { readonly type: 'request-discard' }
  | { readonly type: 'cancel-discard' }
  | {
      readonly type: 'library-loaded';
      readonly entries: readonly LibraryEntryView[];
    }
  | { readonly type: 'begin-rename' }
  | { readonly type: 'begin-delete' }
  | { readonly type: 'cancel-mode' }
  | { readonly type: 'library-error'; readonly message: string | null }
  | { readonly type: 'timeline-opened'; readonly recording: Recording }
  | {
      readonly type: 'replay-started';
      readonly recording: Recording;
      readonly view: ReplayView;
    }
  | { readonly type: 'replay-updated'; readonly view: ReplayView }
  | { readonly type: 'quit' };
