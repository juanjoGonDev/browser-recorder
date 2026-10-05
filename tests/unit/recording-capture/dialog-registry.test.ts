import type { Dialog, Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { createDialogRegistry } from '../../../src/recording-capture/adapters/dialog-registry.ts';

interface FakeDialog {
  readonly dialog: Dialog;
  readonly accept: ReturnType<typeof vi.fn>;
  readonly dismiss: ReturnType<typeof vi.fn>;
}

interface DialogOptions {
  readonly page?: Page;
  readonly type?: string;
  readonly message?: string;
}

function fakeDialog(options: DialogOptions = {}): FakeDialog {
  const accept = vi.fn();
  const dismiss = vi.fn();
  const dialog = {
    accept,
    dismiss,
    page: () => options.page,
    type: () => options.type ?? 'prompt',
    message: () => options.message ?? 'Name?',
  } as unknown as Dialog;
  return { dialog, accept, dismiss };
}

const pageOne = { id: 1 } as unknown as Page;
const pageTwo = { id: 2 } as unknown as Page;

describe('src/recording-capture/adapters/dialog-registry.ts', () => {
  it('accepts the oldest open dialog with the prompt text', async () => {
    const registry = createDialogRegistry();
    const first = fakeDialog();
    const second = fakeDialog();
    registry.add(first.dialog);
    registry.add(second.dialog);
    await registry.respond({ action: 'accept', promptText: 'abc' });
    expect(first.accept).toHaveBeenCalledWith('abc');
    expect(second.accept).not.toHaveBeenCalled();
  });

  it('accepts a confirm without prompt text', async () => {
    const registry = createDialogRegistry();
    const only = fakeDialog();
    registry.add(only.dialog);
    await registry.respond({ action: 'accept', promptText: null });
    expect(only.accept).toHaveBeenCalledWith(undefined);
  });

  it('dismisses, then moves on to the next dialog', async () => {
    const registry = createDialogRegistry();
    const first = fakeDialog();
    const second = fakeDialog();
    registry.add(first.dialog);
    registry.add(second.dialog);
    await registry.respond({ action: 'dismiss', promptText: null });
    await registry.respond({ action: 'accept', promptText: null });
    expect(first.dismiss).toHaveBeenCalledOnce();
    expect(second.accept).toHaveBeenCalledOnce();
  });

  it('does nothing when no dialog is open', async () => {
    const registry = createDialogRegistry();
    await expect(
      registry.respond({ action: 'accept', promptText: null }),
    ).resolves.toBeUndefined();
  });

  it('skips a dialog that was already answered in the browser and answers the next', async () => {
    const registry = createDialogRegistry();
    const stale = fakeDialog();
    stale.accept.mockRejectedValue(new Error('No dialog is showing'));
    const live = fakeDialog();
    registry.add(stale.dialog);
    registry.add(live.dialog);
    await registry.respond({ action: 'accept', promptText: 'abc' });
    expect(live.accept).toHaveBeenCalledWith('abc');
  });

  it('gives up quietly when every open dialog was already answered', async () => {
    const registry = createDialogRegistry();
    const stale = fakeDialog();
    stale.dismiss.mockRejectedValue(new Error('No dialog is showing'));
    registry.add(stale.dialog);
    await expect(
      registry.respond({ action: 'dismiss', promptText: null }),
    ).resolves.toBeUndefined();
    expect(stale.dismiss).toHaveBeenCalledOnce();
  });

  describe('answered in the browser itself', () => {
    it('describes the answer of a dialog nobody answered through the recorder', () => {
      const registry = createDialogRegistry();
      registry.add(fakeDialog({ page: pageOne }).dialog);
      expect(
        registry.settleNatively(pageOne, {
          isAccepted: true,
          userInput: 'abc',
        }),
      ).toEqual({
        dialogType: 'prompt',
        message: 'Name?',
        action: 'accept',
        promptText: 'abc',
      });
    });

    it('reports a dismissal when the browser did not accept', () => {
      const registry = createDialogRegistry();
      registry.add(
        fakeDialog({ page: pageOne, type: 'confirm', message: 'Sure?' }).dialog,
      );
      expect(
        registry.settleNatively(pageOne, { isAccepted: false, userInput: '' }),
      ).toEqual({
        dialogType: 'confirm',
        message: 'Sure?',
        action: 'dismiss',
        promptText: null,
      });
    });

    it('keeps no text for an accepted dialog that is not a prompt', () => {
      const registry = createDialogRegistry();
      registry.add(fakeDialog({ page: pageOne, type: 'alert' }).dialog);
      expect(
        registry.settleNatively(pageOne, { isAccepted: true, userInput: '' }),
      ).toMatchObject({ action: 'accept', promptText: null });
    });

    it('is silent for a dialog the recorder answered itself', async () => {
      const registry = createDialogRegistry();
      registry.add(fakeDialog({ page: pageOne }).dialog);
      await registry.respond({ action: 'accept', promptText: 'abc' });
      expect(
        registry.settleNatively(pageOne, {
          isAccepted: true,
          userInput: 'abc',
        }),
      ).toBeNull();
    });

    it('settles only the dialog of the page that reported it, once', () => {
      const registry = createDialogRegistry();
      registry.add(fakeDialog({ page: pageOne }).dialog);
      expect(
        registry.settleNatively(pageTwo, { isAccepted: true, userInput: '' }),
      ).toBeNull();
      expect(
        registry.settleNatively(pageOne, { isAccepted: true, userInput: '' }),
      ).not.toBeNull();
      expect(
        registry.settleNatively(pageOne, { isAccepted: true, userInput: '' }),
      ).toBeNull();
    });

    it('leaves a settled dialog out of the recorder answers', async () => {
      const registry = createDialogRegistry();
      const settled = fakeDialog({ page: pageOne });
      registry.add(settled.dialog);
      registry.settleNatively(pageOne, { isAccepted: true, userInput: '' });
      await registry.respond({ action: 'accept', promptText: null });
      expect(settled.accept).not.toHaveBeenCalled();
    });
  });
});
