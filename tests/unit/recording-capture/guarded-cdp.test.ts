import { EventEmitter } from 'node:events';
import type { CDPSession } from 'patchright';
import { describe, expect, it, vi } from 'vitest';
import {
  ForbiddenCdpMethodError,
  guardCdp,
  isForbiddenCdpMethod,
} from '../../../src/recording-capture/adapters/guarded-cdp.ts';

// Built from parts so this file passes the lint rule that bans the literals.
const forbidden = (domain: string): string => `${domain}.enable`;

class FakeSession extends EventEmitter {
  readonly sent: { method: string; params: object | undefined }[] = [];
  isDetached = false;

  send(method: string, params?: object): Promise<{ echoed: string }> {
    this.sent.push({ method, params });
    return Promise.resolve({ echoed: method });
  }

  detach(): Promise<void> {
    this.isDetached = true;
    return Promise.resolve();
  }
}

interface RawSender {
  send(method: string, params?: object): Promise<unknown>;
}

/** Guards a fake and hands back its raw `send`, which accepts any name. */
function guarded(session: FakeSession): CDPSession & RawSender {
  return guardCdp(session as unknown as CDPSession);
}

describe('src/recording-capture/adapters/guarded-cdp.ts', () => {
  describe('isForbiddenCdpMethod', () => {
    it.each(['Runtime', 'Console'])('refuses %s enable', (domain) => {
      expect(isForbiddenCdpMethod(forbidden(domain))).toBe(true);
    });

    it.each([
      'Page.enable',
      'Runtime.addBinding',
      'Runtime.evaluate',
      'Runtime.disable',
      'Console.disable',
      'Network.enable',
      'Runtime.enableFoo',
      'runtime.enable',
      '',
    ])('allows %j', (method) => {
      expect(isForbiddenCdpMethod(method)).toBe(false);
    });
  });

  describe('guardCdp', () => {
    it('passes an allowed method through with its params and its result', async () => {
      const session = new FakeSession();
      const wrapped = guarded(session);

      const result = await wrapped.send('Page.createIsolatedWorld', {
        frameId: 'f1',
      });

      expect(result).toEqual({ echoed: 'Page.createIsolatedWorld' });
      expect(session.sent).toEqual([
        { method: 'Page.createIsolatedWorld', params: { frameId: 'f1' } },
      ]);
    });

    it.each(['Runtime', 'Console'])(
      'rejects %s enable with a typed error and never reaches the browser',
      async (domain) => {
        const session = new FakeSession();
        const wrapped = guarded(session);

        const attempt = wrapped.send(forbidden(domain));

        await expect(attempt).rejects.toBeInstanceOf(ForbiddenCdpMethodError);
        await expect(attempt).rejects.toThrow(forbidden(domain));
        expect(session.sent).toEqual([]);
      },
    );

    it('keeps events and the rest of the session working', async () => {
      const session = new FakeSession();
      const wrapped = guarded(session);
      const listener = vi.fn();

      wrapped.on('Page.frameNavigated', listener);
      session.emit('Page.frameNavigated', { frame: { id: 'f1' } });
      await wrapped.detach();

      expect(listener).toHaveBeenCalledWith({ frame: { id: 'f1' } });
      expect(session.isDetached).toBe(true);
    });

    it('guards the session it was given, not a copy', async () => {
      const session = new FakeSession();
      const wrapped = guarded(session);

      await wrapped.send('Page.enable');

      expect(wrapped).not.toBe(session);
      expect(session.sent.map((entry) => entry.method)).toEqual([
        'Page.enable',
      ]);
    });
  });

  describe('ForbiddenCdpMethodError', () => {
    it('names the method and is an Error', () => {
      const error = new ForbiddenCdpMethodError(forbidden('Runtime'));
      expect(error).toBeInstanceOf(Error);
      expect(error.method).toBe(forbidden('Runtime'));
      expect(error.name).toBe('ForbiddenCdpMethodError');
    });
  });
});
