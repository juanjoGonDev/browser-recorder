import type { Locator } from '../../../shared/domain/locator.ts';
import type {
  DialogType,
  PageId,
} from '../../../shared/domain/recording-event.ts';
import type { Viewport } from '../../../shared/domain/recording.ts';
import type { CapturedEvent } from '../../domain/captured-event.ts';

export interface LaunchOptions {
  readonly startUrl: string | null;
  readonly viewport: Viewport;
  readonly isHeadless: boolean;
}

export interface DialogResponse {
  readonly action: 'accept' | 'dismiss';
  readonly promptText: string | null;
}

export type NavigationType =
  | 'navigate'
  | 'reload'
  | 'back_forward'
  | 'push'
  | 'replace'
  | 'traverse'
  | 'unknown';

/** What the browser adapter tells the session, stamped at Node receipt. */
export type SessionSignal = {
  readonly receivedAt: number;
  readonly pageId: PageId;
} & (
  | {
      readonly kind: 'dom';
      readonly framePath: readonly string[];
      readonly payload: CapturedEvent;
      readonly candidates: readonly Locator[];
    }
  | {
      readonly kind: 'navigation';
      readonly url: string;
      readonly navigationType: NavigationType;
      readonly entryIndex: number | null;
    }
  | {
      readonly kind: 'page-opened';
      readonly openerPageId: PageId | null;
      readonly url: string;
    }
  | { readonly kind: 'page-closed' }
  | { readonly kind: 'browser-closed' }
  | {
      readonly kind: 'dialog-opened';
      readonly dialogType: DialogType;
      readonly message: string;
      readonly defaultValue: string;
    }
  /**
   * The browser handled the dialog itself (a headed window shows its own
   * native one), so the recorder's prompt never received the answer.
   */
  | {
      readonly kind: 'dialog-closed';
      readonly dialogType: DialogType;
      readonly message: string;
      readonly action: DialogResponse['action'];
      readonly promptText: string | null;
    }
);

export interface BrowserSession {
  onSignal(listener: (signal: SessionSignal) => void): void;
  respondToDialog(response: DialogResponse): Promise<void>;
  close(): Promise<void>;
}

export interface BrowserLauncher {
  launch(options: LaunchOptions): Promise<BrowserSession>;
}
