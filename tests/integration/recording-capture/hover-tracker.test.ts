import { describe, expect, it } from 'vitest';
import { useCaptureSite } from '../../support/capture-test-site.ts';

describe('src/recording-capture/in-page/hover-tracker.ts', () => {
  const site = useCaptureSite();

  it('records the hover on a CSS menu before the click on its hidden item', async () => {
    const harness = await site.open('hover-menu.html');
    await harness.page.locator('#products-menu').hover();
    await harness.page.waitForTimeout(120);
    await harness.page.locator('#reports-link').click();
    await harness.waitForDom('click');
    const kinds = harness.payloads().map((payload) => payload.kind);
    expect(kinds).toEqual(['hover', 'click']);
    const hover = harness.firstDom('hover');
    expect(hover).toMatchObject({
      payload: { kind: 'hover' },
      candidates: [
        { kind: 'css', selector: '#products-menu' },
        { kind: 'text', text: 'Products Reports' },
      ],
    });
    expect(harness.payloads('hover')[0]?.ageMs).toBeGreaterThanOrEqual(100);
  });

  it('records the hover that revealed a script-driven popover, then its container', async () => {
    const harness = await site.open('hover-menu.html');
    await harness.page.locator('#popover-anchor').hover();
    await harness.page.waitForTimeout(50);
    await harness.page.locator('#popover-action').click();
    await harness.waitForDom('click');
    expect(harness.payloads().map((payload) => payload.kind)).toEqual([
      'hover',
      'hover',
      'click',
    ]);
    const firstCandidates = harness
      .domMessages('hover')
      .map(({ message }) => message.candidates[0]);
    expect(firstCandidates).toEqual([
      { kind: 'css', selector: '#popover-anchor' },
      { kind: 'css', selector: '#popover' },
    ]);
  });

  it('records no hover for elements crossed without a DOM change', async () => {
    const harness = await site.open('button.html');
    await harness.page.locator('#plain').hover();
    await harness.page.locator('#status').hover();
    await harness.page.getByTestId('save-button').click();
    await harness.waitForDom('click');
    expect(harness.domMessages('hover')).toHaveLength(0);
  });

  it('does not repeat a hover for the next action while the pointer stays put', async () => {
    const harness = await site.open('hover-menu.html');
    await harness.page.locator('#products-menu').hover();
    await harness.page.locator('#reports-link').click();
    await harness.page.locator('#reports-link').click();
    await harness.waitForDom('click', 2);
    expect(harness.domMessages('hover')).toHaveLength(1);
  });

  it('records no hover for the label that wraps the control being used', async () => {
    const harness = await site.open('checkbox.html');
    await harness.page.getByLabel('Subscribe').check();
    await harness.waitForDom('check');
    expect(harness.payloads().map((payload) => payload.kind)).toEqual([
      'check',
    ]);
  });

  it('applies the same to a radio inside its label, and to another one after it', async () => {
    const harness = await site.open('checkbox.html');
    await harness.page.getByLabel('Free').check();
    await harness.waitForDom('check');
    await harness.page.getByLabel('Pro').check();
    await harness.waitForDom('check', 2);
    expect(harness.payloads().map((payload) => payload.kind)).toEqual([
      'check',
      'check',
    ]);
  });

  it('still records a hover on an ancestor that is not the control label', async () => {
    const harness = await site.open('hover-menu.html');
    await harness.page.locator('#products-menu').hover();
    await harness.page.locator('#reports-link').click();
    await harness.waitForDom('click');
    expect(harness.payloads().map((payload) => payload.kind)).toEqual([
      'hover',
      'click',
    ]);
  });

  it('clears the trace once another action is recorded', async () => {
    const harness = await site.open('hover-menu.html');
    await harness.page.locator('#popover-anchor').hover();
    await harness.page.keyboard.press('Escape');
    await harness.waitForDom('key');
    await harness.page.locator('#popover-action').click();
    await harness.waitForDom('click');
    const firstCandidates = harness
      .domMessages('hover')
      .map(({ message }) => message.candidates[0]);
    expect(firstCandidates).toEqual([{ kind: 'css', selector: '#popover' }]);
  });
});
