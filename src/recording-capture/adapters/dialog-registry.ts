import type { Dialog } from 'playwright';
import type { DialogResponse } from '../application/ports/browser-launcher.ts';

export interface DialogRegistry {
  add(dialog: Dialog): void;
  /** Answers the oldest dialog still open; a no-op when none is. */
  respond(response: DialogResponse): Promise<void>;
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
