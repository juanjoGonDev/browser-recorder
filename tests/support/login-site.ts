import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export const LOGIN_COOKIE = 'sid=logged-in';
const ONE_HOUR_S = 3600;
const LOOPBACK = '127.0.0.1';

export interface LoginSite {
  readonly baseUrl: string;
  /** The `cookie` header of every request to `/whoami`, oldest first. */
  readonly cookiesSeen: (string | undefined)[];
  close(): Promise<void>;
}

/**
 * `/login` sets a persistent cookie, `/whoami` records what the browser sends
 * with it: a test sees from outside whether a profile kept a login.
 */
export async function startLoginSite(): Promise<LoginSite> {
  const cookiesSeen: (string | undefined)[] = [];
  const server: Server = createServer((request, response) => {
    if (request.url === '/login') {
      response.setHeader(
        'set-cookie',
        `${LOGIN_COOKIE}; Max-Age=${String(ONE_HOUR_S)}; Path=/`,
      );
    } else if (request.url === '/whoami') {
      cookiesSeen.push(request.headers.cookie);
    }
    response.setHeader('content-type', 'text/html');
    response.end('<!doctype html><title>login site</title><p>ok</p>');
  });
  await new Promise<void>((resolve) => {
    server.listen(0, LOOPBACK, resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://${LOOPBACK}:${String(port)}`,
    cookiesSeen,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
        server.closeAllConnections();
      }),
  };
}
