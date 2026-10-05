import { describe, expect, it } from 'vitest';
import { orderByVerification } from '../../../src/recording-capture/adapters/locator-verifier.ts';
import type { Locator } from '../../../src/shared/domain/locator.ts';

const testId: Locator = { kind: 'test-id', testId: 'save' };
const role: Locator = { kind: 'role', role: 'button', name: 'Save' };
const text: Locator = { kind: 'text', text: 'Save' };
const css: Locator = { kind: 'css', selector: '#save' };

function counting(counts: Map<Locator, number>) {
  return (candidate: Locator): Promise<number> =>
    Promise.resolve(counts.get(candidate) ?? 0);
}

describe('src/recording-capture/adapters/locator-verifier.ts', () => {
  describe('orderByVerification', () => {
    it('moves the first candidate Playwright finds exactly once to the front', async () => {
      const counts = new Map<Locator, number>([
        [testId, 0],
        [role, 2],
        [text, 1],
        [css, 1],
      ]);
      await expect(
        orderByVerification([testId, role, text, css], counting(counts)),
      ).resolves.toEqual([text, testId, role, css]);
    });

    it('keeps the order when the first candidate is already unique', async () => {
      const counts = new Map<Locator, number>([
        [testId, 1],
        [role, 1],
      ]);
      await expect(
        orderByVerification([testId, role], counting(counts)),
      ).resolves.toEqual([testId, role]);
    });

    it('keeps the in-page order when no candidate verifies', async () => {
      const counts = new Map<Locator, number>([
        [testId, 3],
        [role, 0],
      ]);
      await expect(
        orderByVerification([testId, role], counting(counts)),
      ).resolves.toEqual([testId, role]);
    });

    it('keeps the in-page order when counting throws, as when the page closed', async () => {
      await expect(
        orderByVerification([testId, role], () =>
          Promise.reject(new Error('Target closed')),
        ),
      ).resolves.toEqual([testId, role]);
    });

    it('gives up after the timeout instead of holding the signal back', async () => {
      const never = (): Promise<number> => new Promise(() => undefined);
      const startedAt = performance.now();
      const ordered = await orderByVerification([testId, role], never, 40);
      expect(ordered).toEqual([testId, role]);
      expect(performance.now() - startedAt).toBeLessThan(400);
    });

    it('spends one timeout on all candidates, not one each', async () => {
      const slow = (): Promise<number> =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(0);
          }, 30);
        });
      const startedAt = performance.now();
      await orderByVerification([testId, role, text, css], slow, 50);
      expect(performance.now() - startedAt).toBeLessThan(110);
    });
  });
});
