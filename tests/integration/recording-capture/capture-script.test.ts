import { describe, expect, it } from 'vitest';
import { useCaptureSite } from '../../support/capture-test-site.ts';

const SCRIPT_GLOBALS = [
  '__browserRecorderEmit',
  'inPageKit',
  '__browser_recorder',
];

describe('src/recording-capture/in-page/capture-script.ts', () => {
  const site = useCaptureSite();

  describe('install guard', () => {
    it('wires a document only once when the script is injected twice', async () => {
      const harness = await site.open('button.html');
      await harness.injectAgain();
      await harness.page.getByTestId('save-button').click();
      await harness.waitForDom('click');
      await harness.page.getByTestId('save-button').click();
      await harness.waitForDom('click', 2);
      await harness.page.waitForTimeout(100);
      expect(harness.domMessages('click')).toHaveLength(2);
    });
  });

  describe('trusted input only', () => {
    it('ignores clicks a page script synthesises', async () => {
      const harness = await site.open('button.html');
      await harness.page.evaluate(() => {
        document.getElementById('save')?.click();
        document
          .getElementById('save')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await harness.page.getByTestId('save-button').click();
      await harness.waitForDom('click');
      expect(harness.domMessages('click')).toHaveLength(1);
    });
  });

  describe('isolation from the page', () => {
    it('adds nothing a page script can see to the page world', async () => {
      const recorded = await site.open('button.html');
      const plain = await site.openPlain('button.html');
      const inspect = (): {
        names: string[];
        symbols: number;
        hasBinding: boolean;
        hasFlag: boolean;
      } => ({
        names: Object.getOwnPropertyNames(window).sort(),
        symbols: Object.getOwnPropertySymbols(window).length,
        hasBinding: '__browserRecorderEmit' in window,
        hasFlag: Symbol.for('browser-recorder.installed') in window,
      });
      const seenWithRecorder = await recorded.page.evaluate(inspect);
      const seenWithout = await plain.evaluate(inspect);
      expect(seenWithRecorder.hasBinding).toBe(false);
      expect(seenWithRecorder.hasFlag).toBe(false);
      expect(seenWithRecorder.names).toEqual(seenWithout.names);
      expect(seenWithRecorder.symbols).toBe(seenWithout.symbols);
      for (const name of SCRIPT_GLOBALS) {
        expect(seenWithRecorder.names).not.toContain(name);
      }
    });

    it('still captures while a page script listens to every event', async () => {
      const harness = await site.open('button.html');
      await harness.page.evaluate(() => {
        for (const type of ['click', 'pointerdown']) {
          window.addEventListener(
            type,
            (event) => {
              event.stopImmediatePropagation();
            },
            true,
          );
        }
      });
      await harness.page.getByTestId('save-button').click();
      await harness.waitForDom('click');
      expect(harness.domMessages('click')).toHaveLength(1);
    });

    it('captures on a page whose strict Content-Security-Policy forbids scripts', async () => {
      const harness = await site.open('csp.html');
      // The page's own inline script is blocked by the policy.
      await expect(harness.page.title()).resolves.toBe('Strict policy');
      await harness.page.getByRole('button', { name: 'Guarded' }).click();
      await harness.waitForDom('click');
      expect(harness.payloads('click')).toMatchObject([
        { description: 'button "Guarded"' },
      ]);
    });
  });
});
