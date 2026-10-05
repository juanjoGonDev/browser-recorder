import { describe, expect, it } from 'vitest';
import { createFramePathResolver } from '../../../src/recording-capture/adapters/frame-path-resolver.ts';
import type { CaptureHarness } from '../../support/capture-harness.ts';
import { useCaptureSite } from '../../support/capture-test-site.ts';

interface Tree {
  frame: { id: string; url: string };
  childFrames?: Tree[];
}

function flatten(tree: Tree): Tree['frame'][] {
  return [tree.frame, ...(tree.childFrames ?? []).flatMap(flatten)];
}

async function frameIdEndingWith(
  harness: CaptureHarness,
  suffix: string,
): Promise<string> {
  const { frameTree } = await harness.cdp.send('Page.getFrameTree');
  const found = flatten(frameTree as Tree).find((frame) =>
    frame.url.endsWith(suffix),
  );
  if (found === undefined) throw new Error(`no frame ends with ${suffix}`);
  return found.id;
}

describe('src/recording-capture/adapters/frame-path-resolver.ts', () => {
  const site = useCaptureSite();

  it('is empty for the main frame', async () => {
    const harness = await site.open('iframe.html');
    const resolver = createFramePathResolver(harness.cdp, harness.world);
    const id = await frameIdEndingWith(harness, 'iframe.html');
    await expect(resolver.resolve(id)).resolves.toEqual([]);
  });

  it('names the iframe element by the css path the capture script computes', async () => {
    const harness = await site.open('iframe.html');
    const resolver = createFramePathResolver(harness.cdp, harness.world);
    const id = await frameIdEndingWith(harness, 'iframe-inner.html');
    await expect(resolver.resolve(id)).resolves.toEqual(['#inner']);
  });

  it('lists every ancestor iframe, outermost first', async () => {
    const harness = await site.open('iframe.html');
    const inner = harness.page
      .frames()
      .find((frame) => frame.url().endsWith('iframe-inner.html'));
    if (inner === undefined) throw new Error('the iframe did not load');
    await inner.evaluate(() => {
      const nested = document.createElement('iframe');
      nested.id = 'deeper';
      nested.src = 'nav-b.html';
      document.body.append(nested);
    });
    await expect
      .poll(() => harness.page.frames().map((frame) => frame.url()))
      .toContainEqual(expect.stringContaining('nav-b.html'));
    const resolver = createFramePathResolver(harness.cdp, harness.world);
    await expect(
      resolver.resolve(await frameIdEndingWith(harness, 'nav-b.html')),
    ).resolves.toEqual(['#inner', '#deeper']);
  });

  it('answers an iframe that was removed with an empty path instead of failing', async () => {
    const harness = await site.open('iframe.html');
    const resolver = createFramePathResolver(harness.cdp, harness.world);
    const id = await frameIdEndingWith(harness, 'iframe-inner.html');
    await harness.page.evaluate(() =>
      document.getElementById('inner')?.remove(),
    );
    await expect(resolver.resolve(id)).resolves.toEqual([]);
  });

  it('remembers a resolved path', async () => {
    const harness = await site.open('iframe.html');
    const resolver = createFramePathResolver(harness.cdp, harness.world);
    const id = await frameIdEndingWith(harness, 'iframe-inner.html');
    const first = await resolver.resolve(id);
    await harness.page.evaluate(() =>
      document.getElementById('inner')?.remove(),
    );
    await expect(resolver.resolve(id)).resolves.toBe(first);
  });
});
