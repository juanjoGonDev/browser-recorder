import { describe, expect, it } from 'vitest';
import { useCaptureSite } from '../../support/capture-test-site.ts';

describe('src/recording-capture/in-page/input-listener.ts', () => {
  const site = useCaptureSite();

  describe('fill', () => {
    it('reports the full value of a text input with its locators', async () => {
      const harness = await site.open('form.html');
      await harness.page.getByLabel('Username').fill('hey');
      await harness.waitForDom('input');
      const message = harness.firstDom('input');
      expect(message).toMatchObject({
        payload: { kind: 'input', value: 'hey', isSensitive: false },
        candidates: [
          { kind: 'role', role: 'textbox', name: 'Username' },
          { kind: 'label', text: 'Username' },
          { kind: 'placeholder', text: 'Your username' },
          { kind: 'css', selector: '#username' },
        ],
      });
    });

    it('reports every keystroke as the whole value so far', async () => {
      const harness = await site.open('form.html');
      await harness.page.getByLabel('Username').pressSequentially('hey');
      await harness.waitForDom('input', 3);
      expect(harness.payloads('input')).toMatchObject([
        { value: 'h' },
        { value: 'he' },
        { value: 'hey' },
      ]);
    });

    it('flags a password input and keeps its value in plain text', async () => {
      const harness = await site.open('form.html');
      await harness.page.getByLabel('Password').fill('s3cret');
      await harness.waitForDom('input');
      expect(harness.payloads('input')).toMatchObject([
        { value: 's3cret', isSensitive: true },
      ]);
    });

    it('flags an input that asks the browser for a new password', async () => {
      const harness = await site.open('form.html');
      await harness.page.evaluate(() => {
        const field = document.getElementById('notes');
        field?.setAttribute('autocomplete', 'new-password');
      });
      await harness.page.locator('#notes').fill('x');
      await harness.waitForDom('input');
      expect(harness.payloads('input')).toMatchObject([{ isSensitive: true }]);
    });

    it('reports a textarea and a contenteditable element', async () => {
      const harness = await site.open('form.html');
      await harness.page.evaluate(() => {
        const editor = document.createElement('div');
        editor.id = 'editor';
        editor.contentEditable = 'true';
        document.body.append(editor);
      });
      await harness.page.locator('#notes').fill('note');
      await harness.page.locator('#editor').pressSequentially('rich');
      await harness.waitForDom('input', 5);
      const values = harness
        .payloads('input')
        .map((payload) => (payload.kind === 'input' ? payload.value : ''));
      expect(values[0]).toBe('note');
      expect(values.at(-1)).toBe('rich');
    });
  });

  describe('select', () => {
    it('reports the selected values when the choice changes', async () => {
      const harness = await site.open('form.html');
      await harness.page.locator('#country').focus();
      // Type-ahead changes a closed select on every platform; arrow keys open
      // the native popup on macOS instead.
      await harness.page.keyboard.type('F');
      await harness.waitForDom('select');
      expect(harness.payloads('select')).toMatchObject([{ values: ['fr'] }]);
      expect(harness.domMessages('input')).toHaveLength(0);
    });
  });

  describe('check', () => {
    it('reports check then uncheck for two clicks on a checkbox', async () => {
      const harness = await site.open('checkbox.html');
      await harness.page.getByLabel('Subscribe').click();
      await harness.page.getByLabel('Subscribe').click();
      await harness.waitForDom('check', 2);
      expect(harness.payloads('check')).toMatchObject([
        { checked: true },
        { checked: false },
      ]);
      expect(harness.domMessages('click')).toHaveLength(0);
    });

    it('reports a radio button once it becomes checked, by its label', async () => {
      const harness = await site.open('checkbox.html');
      await harness.page.getByLabel('Pro').click();
      await harness.waitForDom('check');
      const message = harness.firstDom('check');
      expect(message).toMatchObject({
        payload: { checked: true },
      });
      expect(message.candidates.slice(0, 2)).toEqual([
        { kind: 'role', role: 'radio', name: 'Pro' },
        { kind: 'label', text: 'Pro' },
      ]);
    });
  });

  describe('files', () => {
    it('reports file names only, never their content', async () => {
      const harness = await site.open('file-input.html');
      await harness.page.locator('#avatar').setInputFiles([
        { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('one') },
        { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from('two') },
      ]);
      await harness.waitForDom('files');
      expect(harness.payloads('files')).toMatchObject([
        { fileNames: ['a.txt', 'b.png'] },
      ]);
      expect(JSON.stringify(harness.received)).not.toContain('one');
    });
  });
});
