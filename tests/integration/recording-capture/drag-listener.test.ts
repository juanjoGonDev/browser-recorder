import { describe, expect, it } from 'vitest';
import { useCaptureSite } from '../../support/capture-test-site.ts';

describe('src/recording-capture/in-page/drag-listener.ts', () => {
  const site = useCaptureSite();

  it('reports an HTML5 drag and drop with the dropped element as target', async () => {
    const harness = await site.open('drag.html');
    await harness.page.locator('#item').dragTo(harness.page.locator('#zone'));
    await harness.waitForDom('drag');
    const message = harness.firstDom('drag');
    expect(message).toMatchObject({
      payload: {
        kind: 'drag',
        source: {
          candidates: [
            { kind: 'css', selector: '#item' },
            { kind: 'text', text: 'Drag me' },
          ],
        },
      },
      candidates: [
        { kind: 'css', selector: '#zone' },
        { kind: 'text', text: 'Drop here' },
      ],
    });
    await expect(harness.page.locator('#dropped').textContent()).resolves.toBe(
      'yes',
    );
    expect(harness.domMessages('click')).toHaveLength(0);
    expect(harness.domMessages('drag')).toHaveLength(1);
  });

  it('reports a pointer drag between two elements once, without a click', async () => {
    const harness = await site.open('button.html');
    const from = await harness.page.locator('#save').boundingBox();
    const to = await harness.page.locator('#plain').boundingBox();
    if (from === null || to === null) throw new Error('missing boxes');
    await harness.page.mouse.move(from.x + 4, from.y + 4);
    await harness.page.mouse.down();
    await harness.page.mouse.move(to.x + 4, to.y + 4, { steps: 8 });
    await harness.page.mouse.up();
    await harness.waitForDom('drag');
    await harness.page.waitForTimeout(100);
    expect(harness.domMessages('drag')).toHaveLength(1);
    const drag = harness.firstDom('drag');
    expect(drag.candidates[0]).toEqual({
      kind: 'role',
      role: 'button',
      name: 'Plain',
    });
    const source =
      drag.payload.kind === 'drag' ? drag.payload.source.candidates[0] : null;
    expect(source).toEqual({ kind: 'test-id', testId: 'save-button' });
    expect(harness.domMessages('click')).toHaveLength(0);
  });

  it('does not report movement that stays on one element', async () => {
    const harness = await site.open('button.html');
    const box = await harness.page.locator('#save').boundingBox();
    if (box === null) throw new Error('missing box');
    await harness.page.mouse.move(box.x + 4, box.y + 4);
    await harness.page.mouse.down();
    await harness.page.mouse.move(box.x + 30, box.y + 10, { steps: 4 });
    await harness.page.mouse.up();
    await harness.waitForDom('click');
    expect(harness.domMessages('drag')).toHaveLength(0);
  });
});
