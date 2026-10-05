import type { Dialog, Page } from 'patchright';
import type { DialogType } from '../../shared/domain/recording-event.ts';
import type { DialogResponse } from '../application/ports/browser-launcher.ts';

/** What the browser itself reports when it closes a dialog (CDP). */
export interface DialogClosure {
  readonly isAccepted: boolean;
  readonly userInput: string;
}

/** A dialog that was answered in the browser window, not by the recorder. */
export interface NativeAnswer {
  readonly dialogType: DialogType;
  readonly message: string;
  readonly action: DialogResponse['action'];
  readonly promptText: string | null;
}

export interface DialogRegistry {
  add(dialog: Dialog): void;
  /** Answers the oldest dialog still open; a no-op when none is. */
  respond(response: DialogResponse): Promise<void>;
  /**
   * Called when the browser reports a dialog of `page` closed. Returns what
   * was answered when nobody went through `respond` (a headed browser shows
   * its own native dialog), and `null` when the recorder answered it.
   */
  settleNatively(page: Page, closure: DialogClosure): NativeAnswer | null;
}

async function answer(dialog: Dialog, response: DialogResponse): Promise<void> {
  if (response.action === 'dismiss') await dialog.dismiss();
  else await dialog.accept(response.promptText ?? undefined);
}

/**
 * Holds the dialogs the page is blocked on. Playwright dismisses a dialog
 * nobody answers, so each one waits here for the answer the recorder
 * collects.
 *
 * A headed browser also shows its own native dialog (see the headed dialog
 * test): the user may answer there first, or the page may close under a
 * pending one. Answering such a dialog throws, so it is skipped and the next
 * open dialog is answered instead of leaving the page blocked.
 */
export function createDialogRegistry(): DialogRegistry {
  const open: Dialog[] = [];
  return {
    add: (dialog) => {
      open.push(dialog);
    },
    settleNatively(page, closure) {
      const index = open.findIndex((dialog) => dialog.page() === page);
      const [dialog] = index < 0 ? [] : open.splice(index, 1);
      if (dialog === undefined) return null;
      const dialogType = dialog.type() as DialogType;
      const action = closure.isAccepted ? 'accept' : 'dismiss';
      const hasText = dialogType === 'prompt' && action === 'accept';
      return {
        dialogType,
        message: dialog.message(),
        action,
        promptText: hasText ? closure.userInput : null,
      };
    },
    async respond(response) {
      let dialog = open.shift();
      while (dialog !== undefined) {
        try {
          await answer(dialog, response);
          return;
        } catch {
          // Already answered or gone: try the next one.
          dialog = open.shift();
        }
      }
    },
  };
}
