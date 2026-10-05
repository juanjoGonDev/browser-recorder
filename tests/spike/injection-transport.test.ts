import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BINDING_NAME,
  parseInPageText,
} from '../../src/recording-capture/domain/in-page-message.ts';
import { IN_PAGE_BUNDLE_PATH } from '../support/build-in-page-bundle.ts';
import type { CdpProbe } from '../support/cdp-probe.ts';
import { openCdpProbe } from '../support/cdp-probe.ts';

const WORLD = '__spike_world';
const SETTLE_MS = 400;

function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, SETTLE_MS);
  });
}

/**
 * Transport (b): the capture script is put into the frame's isolated world
 * after the frame commits, with the binding added again for the new world.
 */
async function injectInto(
  probe: CdpProbe,
  frameId: string,
  source: string,
): Promise<number> {
  const contextId = await probe.worldOf(frameId, WORLD);
  await probe.cdp.send('Runtime.addBinding', {
    name: BINDING_NAME,
    executionContextName: WORLD,
  });
  await probe.cdp.send('Runtime.evaluate', { contextId, expression: source });
  return contextId;
}

function clickedLocators(probe: CdpProbe): string[] {
  return probe.bindingCalls
    .map((call) => parseInPageText(call.payload))
    .flatMap((message) =>
      message?.payload.kind === 'click' ? [message.payload.kind] : [],
    );
}

describe('S0 spike: injecting the capture script per frame after commit', () => {
  const source = readFileSync(IN_PAGE_BUNDLE_PATH, 'utf8');
  let probe: CdpProbe;

  beforeAll(async () => {
    probe = await openCdpProbe();
  });

  afterAll(async () => {
    await probe.close();
  });

  it('reports a real click from the isolated world, tagged with the looked-up context', async () => {
    await probe.page.goto(probe.server.urlFor('button.html'));
    const { main } = await probe.frameIds();
    const contextId = await injectInto(probe, main, source);

    await probe.page.click('#save');
    await settle();

    expect(clickedLocators(probe)).toEqual(['click']);
    expect(probe.bindingCalls.map((call) => call.executionContextId)).toEqual([
      contextId,
    ]);
  });

  it('keeps reporting after a navigation once the script is injected again', async () => {
    const before = probe.bindingCalls.length;
    await probe.page.goto(probe.server.urlFor('button.html'));
    const { main } = await probe.frameIds();
    await injectInto(probe, main, source);
    await injectInto(probe, main, source);

    await probe.page.click('#save');
    await settle();

    expect(probe.bindingCalls.length - before).toBe(1);
  });

  it('keeps the page-visible world free of the script', async () => {
    const globals = await probe.page.evaluate(
      () =>
        Object.getOwnPropertyNames(window).filter((name) =>
          /browserrecorder/i.test(name),
        ),
      undefined,
      undefined,
      false,
    );

    expect(globals).toEqual([]);
  });
});
