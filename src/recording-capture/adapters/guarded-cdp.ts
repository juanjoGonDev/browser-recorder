import type { CDPSession } from 'patchright';

/**
 * Enabling these domains makes a page able to tell it is automated, which is
 * exactly what the browser engine swap removed. The names are assembled from
 * parts so no forbidden call appears as a literal anywhere in `src`; a lint
 * rule rejects the literals.
 */
const FORBIDDEN_DOMAINS: readonly string[] = ['Runtime', 'Console'];
const ENABLE_METHOD = 'enable';

export function isForbiddenCdpMethod(method: string): boolean {
  return FORBIDDEN_DOMAINS.some(
    (domain) => method === `${domain}.${ENABLE_METHOD}`,
  );
}

export class ForbiddenCdpMethodError extends Error {
  readonly method: string;

  constructor(method: string) {
    super(`The recorder must never send ${method}: it exposes the automation.`);
    this.name = 'ForbiddenCdpMethodError';
    this.method = method;
  }
}

/**
 * Wraps a CDP session so that sending a forbidden method rejects instead of
 * reaching the browser. Everything else (events, detach, other methods) goes
 * to the session untouched. Wrap every session the recorder opens.
 */
export function guardCdp(session: CDPSession): CDPSession {
  return new Proxy(session, {
    get(target, property, receiver): unknown {
      if (property !== 'send') return Reflect.get(target, property, receiver);
      return (method: string, params?: object): Promise<unknown> =>
        isForbiddenCdpMethod(method)
          ? Promise.reject(new ForbiddenCdpMethodError(method))
          : (target as RawSender).send(method, params);
    },
  });
}

/** `CDPSession.send` is typed per protocol method; the guard sees plain names. */
interface RawSender {
  send(method: string, params?: object): Promise<unknown>;
}
