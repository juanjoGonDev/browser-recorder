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

  describe('inside shadow roots', () => {
    async function wheelOver(
      harness: Awaited<ReturnType<typeof site.open>>,
      selector: string,
    ): Promise<void> {
      const box = await harness.page.locator(selector).boundingBox();
      if (box === null) throw new Error(`missing ${selector}`);
      await harness.page.mouse.move(box.x + 20, box.y + 20);
      await harness.page.mouse.wheel(0, 200);
    }

    async function scrollTopOf(
      harness: Awaited<ReturnType<typeof site.open>>,
      selector: string,
    ): Promise<number> {
      return harness.page
        .locator(selector)
        .evaluate((element) => Math.round(element.scrollTop));
    }

    it('reports the scroll of an element inside an open shadow root', async () => {
      const harness = await site.open('scroll-shadow.html');
      await wheelOver(harness, '#box');
      await harness.waitForDom('scroll');
      await harness.page.waitForTimeout(300);
      const scrolls = harness.domMessages('scroll');
      expect(scrolls).toHaveLength(1);
      expect(scrolls[0]?.message).toMatchObject({
        payload: {
          kind: 'scroll',
          x: 0,
          y: await scrollTopOf(harness, '#box'),
        },
        candidates: [
          { kind: 'css', selector: '#box' },
          { kind: 'text', text: 'Open box' },
        ],
      });
      expect(await scrollTopOf(harness, '#box')).toBeGreaterThan(0);
    });

    it('reports the scroll of an element inside nested shadow roots', async () => {
      const harness = await site.open('scroll-shadow.html');
      await wheelOver(harness, '#deep');
      await harness.waitForDom('scroll');
      await harness.page.waitForTimeout(300);
      expect(harness.domMessages('scroll')).toHaveLength(1);
      expect(harness.firstDom('scroll')).toMatchObject({
        payload: { y: await scrollTopOf(harness, '#deep') },
        candidates: [
          { kind: 'css', selector: '#deep' },
          { kind: 'text', text: 'Deep box' },
        ],
      });
    });

    it('reports a scroll inside a shadow root attached after the page loaded', async () => {
      const harness = await site.open('scroll-shadow.html');
      await harness.page.locator('#attach').click();
      await wheelOver(harness, '#late');
      await harness.waitForDom('scroll');
      expect(harness.firstDom('scroll').candidates).toMatchObject([
        { kind: 'css', selector: '#late' },
        { kind: 'text', text: 'Late box' },
      ]);
    });

    it('reports a scroll inside a shadow root of an iframe from that frame', async () => {
      const harness = await site.open('scroll-shadow.html');
      await harness.page
        .frameLocator('iframe#inner')
        .locator('#framed')
        .hover();
      await harness.page.mouse.wheel(0, 200);
      await harness.waitForDom('scroll');
      const scroll = harness.domMessages('scroll').at(0);
      expect(scroll?.isMainFrame).toBe(false);
      expect(scroll?.message).toMatchObject({
        candidates: [
          { kind: 'css', selector: '#framed' },
          { kind: 'text', text: 'Framed box' },
        ],
      });
    });

    it('leaves no trace in the main world while it watches shadow roots', async () => {
      const harness = await site.open('scroll-shadow.html');
      await wheelOver(harness, '#box');
      await harness.waitForDom('scroll');
      const plain = await site.openPlain('scroll-shadow.html');
      const traceOf = (page: typeof plain) =>
        page.evaluate(() => ({
          globals: Object.getOwnPropertyNames(window).sort(),
          spyCalls: (window as unknown as { spy: { calls: number } }).spy.calls,
        }));
      const recorded = await traceOf(harness.page);
      const untouched = await traceOf(plain);
      expect(recorded.spyCalls).toBe(0);
      expect(recorded.globals).toStrictEqual(untouched.globals);
    });

    it('does not reach a closed shadow root: the documented limitation', async () => {
      const harness = await site.open('scroll-shadow.html');
      await wheelOver(harness, '#vault');
      await harness.page.waitForTimeout(500);
      expect(harness.domMessages('scroll')).toHaveLength(0);
    });

    it('ignores a scroll the page performs on its own inside a shadow root', async () => {
      const harness = await site.open('scroll-shadow.html');
      await harness.page.locator('#box').evaluate((element) => {
        element.scrollTop = 120;
      });
      await harness.page.waitForTimeout(400);
      expect(harness.domMessages('scroll')).toHaveLength(0);
    });
  });
});
