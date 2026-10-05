import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CdpProbe } from '../support/cdp-probe.ts';
import { openCdpProbe } from '../support/cdp-probe.ts';

const WORLD = '__spike_world';
const OTHER_WORLD = '__spike_other_world';

describe('S0 spike: Page.createIsolatedWorld with a world name', () => {
  let probe: CdpProbe;

  beforeAll(async () => {
    probe = await openCdpProbe();
  });

  afterAll(async () => {
    await probe.close();
  });

  it('returns the same context id for repeated lookups of one frame', async () => {
    await probe.page.goto(probe.server.urlFor('iframe.html'));
    const { main } = await probe.frameIds();

    const first = await probe.worldOf(main, WORLD);
    const second = await probe.worldOf(main, WORLD);

    expect(second).toBe(first);
  });

  it('keeps worlds apart by name and by frame', async () => {
    const { main, children } = await probe.frameIds();
    const [child = ''] = children;

    const mainWorld = await probe.worldOf(main, WORLD);
    const otherName = await probe.worldOf(main, OTHER_WORLD);
    const childWorld = await probe.worldOf(child, WORLD);

    expect(new Set([mainWorld, otherName, childWorld]).size).toBe(3);
  });

  it('creates a new world per document and reuses it within that document', async () => {
    const before = await probe.frameIds();
    const oldContext = await probe.worldOf(before.main, WORLD);

    await probe.page.goto(probe.server.urlFor('nav-b.html'));
    const after = await probe.frameIds();
    const newContext = await probe.worldOf(after.main, WORLD);
    const again = await probe.worldOf(after.main, WORLD);

    expect(after.main).toBe(before.main);
    expect(newContext).not.toBe(oldContext);
    expect(again).toBe(newContext);
  });

  it('reports a binding call with the context id the lookup returned', async () => {
    const { main } = await probe.frameIds();
    const contextId = await probe.worldOf(main, WORLD);
    await probe.cdp.send('Runtime.addBinding', {
      name: '__spike_ping',
      executionContextName: WORLD,
    });

    await probe.cdp.send('Runtime.evaluate', {
      contextId,
      expression: "__spike_ping('where')",
    });
    await probe.page.waitForTimeout(200);

    expect(probe.bindingCalls.map((call) => call.executionContextId)).toEqual([
      contextId,
    ]);
  });
});
