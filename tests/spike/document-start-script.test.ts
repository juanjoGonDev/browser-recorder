import { afterEach, describe, expect, it } from 'vitest';
import type { CdpProbe } from '../support/cdp-probe.ts';
import { openCdpProbe } from '../support/cdp-probe.ts';

const WORLD = '__spike_world';
const MARK_SCRIPT = `document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-spike', 'ran');
});`;

async function registerMarkScript(probe: CdpProbe): Promise<void> {
  await probe.cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: MARK_SCRIPT,
    worldName: WORLD,
    runImmediately: true,
  });
}

async function readMainMark(probe: CdpProbe): Promise<string | null> {
  return probe.page.evaluate(() => document.body.getAttribute('data-spike'));
}

describe('S0 spike: Page.addScriptToEvaluateOnNewDocument for a named world', () => {
  let probe: CdpProbe | undefined;

  afterEach(async () => {
    await probe?.close();
    probe = undefined;
  });

  it('does not run in the main frame when the session never used the Runtime domain', async () => {
    probe = await openCdpProbe();
    await registerMarkScript(probe);

    await probe.page.goto(probe.server.urlFor('iframe.html'));

    await expect(readMainMark(probe)).resolves.toBeNull();
  });

  it('runs in the main frame once the session has sent any Runtime command', async () => {
    probe = await openCdpProbe();
    await probe.cdp.send('Runtime.evaluate', { expression: '1' });
    await registerMarkScript(probe);

    await probe.page.goto(probe.server.urlFor('iframe.html'));

    await expect(readMainMark(probe)).resolves.toBe('ran');
  });
});
