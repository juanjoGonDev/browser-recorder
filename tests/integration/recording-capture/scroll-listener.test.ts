import { describe, expect, it } from 'vitest';
import { useCaptureSite } from '../../support/capture-test-site.ts';

// Real wheel input is the only thing that counts as scrolling intent.
describe('src/recording-capture/in-page/scroll-listener.ts', () => {
  const site = useCaptureSite();

  it('reports one scroll after a burst of wheel input settles', async () => {
    const harness = await site.open('scroll.html');
    await harness.page.mouse.move(600, 400);
    for (let step = 0; step < 5; step += 1) {
      await harness.page.mouse.wheel(0, 120);
    }
    await harness.waitForDom('scroll');
    await harness.page.waitForTimeout(300);
    const scrolls = harness.payloads('scroll');
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0]).toMatchObject({ kind: 'scroll', x: 0, y: 600 });
    expect(harness.domMessages('scroll')[0]?.message).toMatchObject({
      candidates: [],
    });
  });

  it('dates the scroll to the last scroll event, not to the report', async () => {
    const harness = await site.open('scroll.html');
    await harness.page.mouse.move(600, 400);
    await harness.page.mouse.wheel(0, 300);
    await harness.waitForDom('scroll');
    const scroll = harness.payloads('scroll').at(0);
    expect(scroll?.ageMs).toBeGreaterThanOrEqual(120);
    expect(scroll?.ageMs).toBeLessThan(600);
  });

  it('ignores a scroll the page performs on its own', async () => {
    const harness = await site.open('scroll.html');
    await harness.page.evaluate(() => {
      window.scrollTo(0, 800);
    });
    await harness.page.waitForTimeout(500);
    expect(harness.domMessages('scroll')).toHaveLength(0);
  });

  it('reports a scrollable element with its own locators', async () => {
    const harness = await site.open('scroll.html');
    const panel = await harness.page.locator('#panel').boundingBox();
    if (panel === null) throw new Error('missing panel');
    await harness.page.mouse.move(panel.x + 20, panel.y + 20);
    await harness.page.mouse.wheel(0, 200);
    await harness.waitForDom('scroll');
    const message = harness.firstDom('scroll');
    expect(message).toMatchObject({
      payload: { kind: 'scroll', x: 0, y: 200 },
      candidates: [
        { kind: 'css', selector: '#panel' },
        { kind: 'text', text: 'Scrollable panel' },
      ],
    });
  });

  it('counts a scroll key as intent', async () => {
    const harness = await site.open('scroll.html');
    await harness.page.keyboard.press('PageDown');
    await harness.waitForDom('scroll');
    expect(harness.payloads('scroll')[0]).toMatchObject({ kind: 'scroll' });
    expect(harness.payloads('key')).toMatchObject([{ key: 'PageDown' }]);
  });

  it('flushes a pending scroll before the next action so the order is kept', async () => {
    const harness = await site.open('scroll.html');
    await harness.page.mouse.move(600, 400);
    await harness.page.mouse.wheel(0, 2400);
    await harness.page.waitForTimeout(40);
    await harness.page.locator('#bottom').click();
    await harness.waitForDom('click');
    const kinds = harness.payloads().map((payload) => payload.kind);
    expect(kinds).toEqual(['scroll', 'click']);
  });
});
