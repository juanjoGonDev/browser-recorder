import { describe, expect, it } from 'vitest';
import type { InPageMessage } from '../../../src/recording-capture/domain/in-page-message.ts';
import type { CaptureHarness } from '../../support/capture-harness.ts';
import { useCaptureSite } from '../../support/capture-test-site.ts';

type Navigation = Extract<InPageMessage, { kind: 'navigation' }>;

function navigations(harness: CaptureHarness): Navigation[] {
  return harness.received.flatMap(({ message }) =>
    message.kind === 'navigation' ? [message] : [],
  );
}

async function waitForNavigations(
  harness: CaptureHarness,
  count: number,
): Promise<void> {
  await harness.waitFor(() => navigations(harness).length >= count);
}

describe('src/recording-capture/in-page/navigation-listener.ts', () => {
  const site = useCaptureSite();

  it('reports a document load with its navigation type and history index', async () => {
    const harness = await site.open('nav-a.html');
    await waitForNavigations(harness, 1);
    const [load] = navigations(harness);
    expect(load.navigationType).toBe('navigate');
    expect(load.url).toContain('nav-a.html');
    expect(load.entryIndex).toBeTypeOf('number');
  });

  it('reports a reload as reload', async () => {
    const harness = await site.open('nav-a.html');
    await waitForNavigations(harness, 1);
    await harness.page.reload();
    await waitForNavigations(harness, 2);
    expect(navigations(harness)[1]?.navigationType).toBe('reload');
  });

  it('reports back and forward with a falling then rising entry index', async () => {
    const harness = await site.open('nav-a.html');
    await harness.page.locator('#to-b').click();
    await waitForNavigations(harness, 2);
    await harness.page.goBack();
    await waitForNavigations(harness, 3);
    await harness.page.goForward();
    await waitForNavigations(harness, 4);
    const [, forward, back, again] = navigations(harness);
    expect([back.navigationType, again.navigationType]).toEqual([
      'back_forward',
      'back_forward',
    ]);
    expect(back.entryIndex).toBe((forward.entryIndex ?? 0) - 1);
    expect(again.entryIndex).toBe(forward.entryIndex);
  });

  it('reports a same-document push as a push', async () => {
    const harness = await site.open('nav-a.html');
    await waitForNavigations(harness, 1);
    await harness.page.locator('#push-state').click();
    await waitForNavigations(harness, 2);
    const [, push] = navigations(harness);
    expect(push.navigationType).toBe('push');
    expect(push.url).toContain('step=2');
  });

  it('reports the main frame only, never an iframe', async () => {
    const harness = await site.open('iframe.html');
    await waitForNavigations(harness, 1);
    await harness.page.waitForTimeout(200);
    expect(navigations(harness)).toHaveLength(1);
    expect(harness.received.every(({ isMainFrame }) => isMainFrame)).toBe(true);
  });

  it('stays silent for the initial blank document', async () => {
    const harness = await site.open('nav-a.html');
    await waitForNavigations(harness, 1);
    expect(
      navigations(harness).some(({ url }) => url.startsWith('about:')),
    ).toBe(false);
  });
});
