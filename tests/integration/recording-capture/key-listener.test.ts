import { describe, expect, it } from 'vitest';
import { useCaptureSite } from '../../support/capture-test-site.ts';

describe('src/recording-capture/in-page/key-listener.ts', () => {
  const site = useCaptureSite();

  it('reports Enter pressed in an input with that input as the target', async () => {
    const harness = await site.open('form.html');
    await harness.page.getByLabel('Username').focus();
    await harness.page.keyboard.press('Enter');
    await harness.waitForDom('key');
    const message = harness.firstDom('key');
    expect(message).toMatchObject({
      payload: { kind: 'key', key: 'Enter' },
      candidates: [
        { kind: 'role', role: 'textbox', name: 'Username' },
        { kind: 'label', text: 'Username' },
        { kind: 'placeholder', text: 'Your username' },
        { kind: 'css', selector: '#username' },
      ],
    });
  });

  it('reports a shortcut as one canonical key with no element target', async () => {
    const harness = await site.open('button.html');
    await harness.page.keyboard.press('Control+Shift+K');
    await harness.waitForDom('key');
    const message = harness.firstDom('key');
    expect(message).toMatchObject({
      payload: { key: 'Control+Shift+K', description: '' },
      candidates: [],
    });
  });

  it('leaves typed characters and editing keys inside a field to the input events', async () => {
    const harness = await site.open('form.html');
    await harness.page.getByLabel('Username').focus();
    await harness.page.keyboard.type('abc');
    await harness.page.keyboard.press('Backspace');
    await harness.page.keyboard.press('ArrowLeft');
    await harness.page.keyboard.press('Control+A');
    await harness.page.keyboard.press('Tab');
    await harness.waitForDom('key');
    await harness.page.waitForTimeout(100);
    expect(harness.payloads('key')).toMatchObject([{ key: 'Tab' }]);
  });

  it('keeps ArrowDown and Escape inside a field', async () => {
    const harness = await site.open('form.html');
    await harness.page.getByLabel('Username').focus();
    await harness.page.keyboard.press('ArrowDown');
    await harness.page.keyboard.press('Escape');
    await harness.waitForDom('key', 2);
    expect(harness.payloads('key')).toMatchObject([
      { key: 'ArrowDown' },
      { key: 'Escape' },
    ]);
  });

  it('does not report the arrows that only change a select, which change reports', async () => {
    const harness = await site.open('form.html');
    await harness.page.locator('#country').focus();
    await harness.page.keyboard.press('ArrowDown');
    await harness.page.keyboard.press('ArrowDown');
    await harness.page.keyboard.type('F');
    await harness.waitForDom('select');
    expect(harness.domMessages('key')).toHaveLength(0);
  });

  it('reports a held key once and a modifier alone never', async () => {
    const harness = await site.open('button.html');
    await harness.page.keyboard.down('Control');
    await harness.page.keyboard.down('Enter');
    await harness.page.keyboard.down('Enter');
    await harness.page.keyboard.up('Enter');
    await harness.page.keyboard.up('Control');
    await harness.waitForDom('key');
    await harness.page.waitForTimeout(100);
    expect(harness.payloads('key')).toMatchObject([{ key: 'Control+Enter' }]);
  });

  it('names the space key so a replay can press it', async () => {
    const harness = await site.open('button.html');
    await harness.page.keyboard.press('Control+Space');
    await harness.waitForDom('key');
    expect(harness.payloads('key')).toMatchObject([{ key: 'Control+Space' }]);
  });
});
