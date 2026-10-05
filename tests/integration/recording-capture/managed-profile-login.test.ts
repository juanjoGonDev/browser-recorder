import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPatchrightBrowserLauncher } from '../../../src/recording-capture/adapters/patchright-browser-launcher.ts';
import { createPerformanceClock } from '../../../src/recording-capture/adapters/performance-clock.ts';
import type { SessionSignal } from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import { IN_PAGE_BUNDLE_PATH } from '../../support/build-in-page-bundle.ts';

const COOKIE = 'sid=logged-in';
const ONE_HOUR_S = 3600;
const WAIT = { timeout: 10_000, interval: 50 };

interface LoginSite {
  readonly baseUrl: string;
  /** The `cookie` header of every request to `/whoami`, oldest first. */
  readonly cookiesSeen: (string | undefined)[];
  close(): Promise<void>;
}

/** `/login` sets a persistent cookie; `/whoami` records what the browser sends. */
async function startLoginSite(): Promise<LoginSite> {
  const cookiesSeen: (string | undefined)[] = [];
  const server: Server = createServer((request, response) => {
    if (request.url === '/login') {
      response.setHeader(
        'set-cookie',
        `${COOKIE}; Max-Age=${String(ONE_HOUR_S)}; Path=/`,
      );
    } else {
      cookiesSeen.push(request.headers.cookie);
    }
    response.setHeader('content-type', 'text/html');
    response.end('<!doctype html><title>login site</title><p>ok</p>');
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${String(port)}`,
    cookiesSeen,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

describe('src/recording-capture/adapters/patchright-browser-launcher.ts (managed profile)', () => {
  let site: LoginSite;
  const directories: string[] = [];
  const launcher = createPatchrightBrowserLauncher({
    clock: createPerformanceClock(),
    inPageScriptPath: IN_PAGE_BUNDLE_PATH,
  });

  async function newProfileDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'br-managed-'));
    directories.push(dir);
    return dir;
  }

  /** Opens the profile on a path of the site and closes it once loaded. */
  async function visit(userDataDir: string, path: string): Promise<void> {
    const signals: SessionSignal[] = [];
    const session = await launcher.launch({
      startUrl: `${site.baseUrl}${path}`,
      display: { kind: 'emulated', width: 800, height: 600 },
      isHeadless: true,
      target: {
        executablePath: null,
        userDataDir,
        browserArgs: [],
        shouldUseRealKeychain: false,
      },
    });
    session.onSignal((signal) => signals.push(signal));
    await vi.waitFor(() => {
      expect(signals.some(({ kind }) => kind === 'navigation')).toBe(true);
    }, WAIT);
    await session.close();
  }

  beforeAll(async () => {
    site = await startLoginSite();
  });
  afterAll(async () => {
    await site.close();
    await Promise.all(
      directories.map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('keeps a login across two launches on the same managed directory', async () => {
    const managed = await newProfileDir();
    await visit(managed, '/login');
    await visit(managed, '/whoami');
    expect(site.cookiesSeen.at(-1)).toBe(COOKIE);
  });

  it('does not leak the login into a different directory', async () => {
    await visit(await newProfileDir(), '/whoami');
    expect(site.cookiesSeen.at(-1)).toBeUndefined();
  });
});
