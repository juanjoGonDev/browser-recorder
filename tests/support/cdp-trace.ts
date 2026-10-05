import type { BrowserContext } from 'patchright';

type RawSend = (method: string, params?: object) => Promise<unknown>;

/**
 * Records every CDP method sent through any session opened with
 * `context.newCDPSession` from now on, in order. The recording sits closest to
 * the browser, so it lists what really reached it.
 */
export function traceSessions(context: BrowserContext): string[] {
  const sent: string[] = [];
  const open = context.newCDPSession.bind(context);
  (context as { newCDPSession: typeof open }).newCDPSession = async (
    target,
  ) => {
    const session = await open(target);
    const send = session.send.bind(session) as RawSend;
    (session as unknown as { send: RawSend }).send = (method, params) => {
      sent.push(method);
      return send(method, params);
    };
    return session;
  };
  return sent;
}
