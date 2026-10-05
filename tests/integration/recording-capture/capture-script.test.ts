import { describe, expect, it } from 'vitest';
import { IN_PAGE_BUNDLE_PATH } from '../../support/build-in-page-bundle.ts';
import { useCaptureSite } from '../../support/capture-test-site.ts';

const INSTALL_KEY = 'browser-recorder.installed';

describe('src/recording-capture/in-page/capture-script.ts', () => {
  const site = useCaptureSite();

  describe('install guard', () => {
    it('marks the window with a non-enumerable Symbol.for flag', async () => {
      const { page } = await site.open('button.html');
      const flag = await page.evaluate((key) => {
        const symbol = Symbol.for(key);
        return {
          isSet: symbol in window,
          isEnumerable: Object.prototype.propertyIsEnumerable.call(
            window,
            symbol,
          ),
        };
      }, INSTALL_KEY);
      expect(flag).toEqual({ isSet: true, isEnumerable: false });
    });

    it('wires the document only once when the script is injected twice', async () => {
      const harness = await site.open('button.html');
      await harness.page.addScriptTag({ path: IN_PAGE_BUNDLE_PATH });
      await harness.page.getByTestId('save-button').click();
      await harness.waitForDom('click');
      await harness.page.getByTestId('save-button').click();
      await harness.waitForDom('click', 2);
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

    it('drops a malformed message a page sends to the binding', async () => {
      const harness = await site.open('button.html');
      await harness.page.evaluate(() => {
        const binding = (
          window as unknown as Record<string, (m: unknown) => unknown>
        ).__browserRecorderEmit;
        void binding({ kind: 'dom', payload: 'nope' });
      });
      await expect
        .poll(() => harness.rejectedCount(), { timeout: 3000 })
        .toBe(1);
      expect(harness.domMessages()).toHaveLength(0);
    });
  });
});
