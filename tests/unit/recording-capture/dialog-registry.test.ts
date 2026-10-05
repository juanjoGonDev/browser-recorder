import type { Dialog } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { createDialogRegistry } from '../../../src/recording-capture/adapters/dialog-registry.ts';

interface FakeDialog {
  readonly dialog: Dialog;
  readonly accept: ReturnType<typeof vi.fn>;
  readonly dismiss: ReturnType<typeof vi.fn>;
}

function fakeDialog(): FakeDialog {
  const accept = vi.fn();
  const dismiss = vi.fn();
  return { dialog: { accept, dismiss } as unknown as Dialog, accept, dismiss };
}

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
});
