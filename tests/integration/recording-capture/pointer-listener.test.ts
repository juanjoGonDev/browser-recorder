import { describe, expect, it } from 'vitest';
import { useCaptureSite } from '../../support/capture-test-site.ts';

describe('src/recording-capture/in-page/pointer-listener.ts', () => {
  const site = useCaptureSite();

  describe('buttons and modifiers', () => {
    it('reports a left click with the ranked candidates of the target', async () => {
      const harness = await site.open('button.html');
      await harness.page.getByTestId('save-button').click();
      await harness.waitForDom('click');
      const message = harness.firstDom('click');
      expect(message).toMatchObject({
        payload: {
          kind: 'click',
          button: 'left',
          modifiers: [],
          ageMs: 0,
          description: 'button "Save"',
        },
      });
      expect(message.candidates.slice(0, 2)).toEqual([
        { kind: 'test-id', testId: 'save-button' },
        { kind: 'role', role: 'button', name: 'Save' },
      ]);
    });

    it('stores one click for a Shift right click', async () => {
      const harness = await site.open('button.html');
      await harness.page
        .getByTestId('save-button')
        .click({ button: 'right', modifiers: ['Shift'] });
      await harness.waitForDom('click');
      await harness.page.waitForTimeout(100);
      expect(harness.payloads('click')).toMatchObject([
        { button: 'right', modifiers: ['Shift'] },
      ]);
    });

    it('stores one click for a middle click', async () => {
      const harness = await site.open('button.html');
      await harness.page.getByTestId('save-button').click({ button: 'middle' });
      await harness.waitForDom('click');
      await harness.page.waitForTimeout(100);
      expect(harness.payloads('click')).toMatchObject([{ button: 'middle' }]);
    });

    it('lists every held modifier in a fixed order', async () => {
      const harness = await site.open('button.html');
      await harness.page
        .getByTestId('save-button')
        .click({ modifiers: ['Shift', 'Control', 'Alt'] });
      await harness.waitForDom('click');
      expect(harness.payloads('click')).toMatchObject([
        { modifiers: ['Alt', 'Control', 'Shift'] },
      ]);
    });

    it('reports a double click as its two clicks and a raw dblclick', async () => {
      const harness = await site.open('button.html');
      await harness.page.getByTestId('save-button').dblclick();
      await harness.waitForDom('dblclick');
      expect(harness.payloads().map((payload) => payload.kind)).toEqual([
        'click',
        'click',
        'dblclick',
      ]);
    });
  });

  describe('targets', () => {
    it('retargets a click on a child to the closest interactive ancestor', async () => {
      const harness = await site.open('button.html');
      await harness.page.evaluate(() => {
        const save = document.getElementById('save');
        if (save) save.innerHTML = '<span id="inner">Save</span>';
      });
      await harness.page.locator('#inner').click();
      await harness.waitForDom('click');
      expect(harness.payloads('click')).toMatchObject([
        { description: 'button "Save"' },
      ]);
    });

    it('reports a click in an iframe from that frame', async () => {
      const harness = await site.open('iframe.html');
      await harness.page
        .frameLocator('#inner')
        .getByRole('button', { name: 'Inner action' })
        .click();
      await harness.waitForDom('click');
      const message = harness.firstDom('click');
      expect(message.isMainFrame).toBe(false);
      expect(message.frameUrl).toContain('iframe-inner.html');
    });

    it('reports a click inside a shadow root', async () => {
      const harness = await site.open('shadow-dom.html');
      await harness.page.locator('#shadow-button').click();
      await harness.waitForDom('click');
      expect(harness.payloads('click')).toMatchObject([
        { description: 'button "Shadow action"' },
      ]);
    });
  });

  describe('suppression', () => {
    it('leaves a checkbox click to the change event', async () => {
      const harness = await site.open('checkbox.html');
      await harness.page.locator('#newsletter').click();
      await harness.waitForDom('check');
      expect(harness.domMessages('click')).toHaveLength(0);
    });

    it('leaves a click on the label of a checkbox or radio to the change event', async () => {
      const harness = await site.open('checkbox.html');
      await harness.page.getByText('Subscribe').click();
      await harness.page.getByText('Pro', { exact: true }).click();
      await harness.waitForDom('check', 2);
      expect(harness.domMessages('click')).toHaveLength(0);
    });

    it('reports the click a keyboard activation causes', async () => {
      const harness = await site.open('button.html');
      await harness.page.getByTestId('save-button').focus();
      await harness.page.keyboard.press('Space');
      await harness.waitForDom('click');
      expect(harness.payloads('click')).toMatchObject([{ button: 'left' }]);
    });

    it('does not duplicate Enter as a click', async () => {
      const harness = await site.open('button.html');
      await harness.page.getByTestId('save-button').focus();
      await harness.page.keyboard.press('Enter');
      await harness.waitForDom('key');
      await harness.page.waitForTimeout(100);
      expect(harness.domMessages('click')).toHaveLength(0);
      expect(harness.payloads('key')).toMatchObject([{ key: 'Enter' }]);
    });

    it('does not report a click after a pointer drag to another element', async () => {
      const harness = await site.open('button.html');
      const from = await harness.page.locator('#save').boundingBox();
      const to = await harness.page.locator('#plain').boundingBox();
      if (from === null || to === null) throw new Error('missing boxes');
      await harness.page.mouse.move(from.x + 4, from.y + 4);
      await harness.page.mouse.down();
      await harness.page.mouse.move(to.x + 4, to.y + 4, { steps: 8 });
      await harness.page.mouse.up();
      await harness.waitForDom('drag');
      expect(harness.domMessages('click')).toHaveLength(0);
    });

    it('still reports a click when the pointer moved less than the drag threshold', async () => {
      const harness = await site.open('button.html');
      const box = await harness.page.locator('#save').boundingBox();
      if (box === null) throw new Error('missing box');
      await harness.page.mouse.move(box.x + 4, box.y + 4);
      await harness.page.mouse.down();
      await harness.page.mouse.move(box.x + 7, box.y + 5);
      await harness.page.mouse.up();
      await harness.waitForDom('click');
      expect(harness.domMessages('drag')).toHaveLength(0);
    });
  });
});
