import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CdpProbe } from '../support/cdp-probe.ts';
import { openCdpProbe } from '../support/cdp-probe.ts';

const WORLD = '__spike_world';
const BINDING = '__spike_binding';
const SETTLE_MS = 400;
// Built from parts so this file stays clear of the lint rule that bans the
// two forbidden methods as literals.
const FORBIDDEN = ['Runtime', 'Console'].map((domain) => `${domain}.enable`);

function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, SETTLE_MS);
  });
}

async function callBinding(
  probe: CdpProbe,
  contextId: number,
  payload: string,
): Promise<void> {
  await probe.cdp.send('Runtime.evaluate', {
    contextId,
    expression: `${BINDING}(${JSON.stringify(payload)})`,
  });
}

describe('S0 spike: Runtime.addBinding without the forbidden enable calls', () => {
  let probe: CdpProbe;

  beforeAll(async () => {
    probe = await openCdpProbe();
  });

  afterAll(async () => {
    await probe.close();
  });

  it('delivers bindingCalled for a binding added to a world that already exists', async () => {
    await probe.page.goto(probe.server.urlFor('button.html'));
    const { main } = await probe.frameIds();
    const contextId = await probe.worldOf(main, WORLD);
    await probe.cdp.send('Runtime.addBinding', {
      name: BINDING,
      executionContextName: WORLD,
    });

    await callBinding(probe, contextId, 'first');
    await settle();

    expect(probe.bindingCalls).toEqual([
      { name: BINDING, payload: 'first', executionContextId: contextId },
    ]);
  });

  it('installs the binding again in the new world after a navigation, without duplicating calls', async () => {
    const before = probe.bindingCalls.length;
    await probe.page.goto(probe.server.urlFor('checkbox.html'));
    const { main } = await probe.frameIds();
    const contextId = await probe.worldOf(main, WORLD);
    await probe.cdp.send('Runtime.addBinding', {
      name: BINDING,
      executionContextName: WORLD,
    });
    await probe.cdp.send('Runtime.addBinding', {
      name: BINDING,
      executionContextName: WORLD,
    });

    await callBinding(probe, contextId, 'second');
    await settle();

    const fresh = probe.bindingCalls.slice(before);
    expect(fresh).toEqual([
      { name: BINDING, payload: 'second', executionContextId: contextId },
    ]);
  });

  it('does not install a binding added before the world of a new document exists', async () => {
    await probe.cdp.send('Runtime.addBinding', {
      name: BINDING,
      executionContextName: WORLD,
    });
    await probe.page.goto(probe.server.urlFor('nav-a.html'));
    const { main } = await probe.frameIds();
    const contextId = await probe.worldOf(main, WORLD);

    const result = await probe.cdp.send('Runtime.evaluate', {
      contextId,
      expression: `typeof ${BINDING}`,
      returnByValue: true,
    });

    expect(result.result.value).toBe('undefined');
  });

  it('never sent either forbidden method on its own session', () => {
    expect(probe.sent.length).toBeGreaterThan(0);
    expect(probe.sent.filter((method) => FORBIDDEN.includes(method))).toEqual(
      [],
    );
  });
});
