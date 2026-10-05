import type { BrowserContext, CDPSession, Frame, Page } from 'patchright';
import { guardCdp } from './guarded-cdp.ts';

/**
 * The one place the recorder opens a CDP session. Every session comes back
 * wrapped, so no code path can send a call that exposes the automation.
 */
export async function openGuardedSession(
  context: BrowserContext,
  target: Page | Frame,
): Promise<CDPSession> {
  return guardCdp(await context.newCDPSession(target));
}
