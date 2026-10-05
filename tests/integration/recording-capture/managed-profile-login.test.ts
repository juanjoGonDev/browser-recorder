import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPatchrightBrowserLauncher } from '../../../src/recording-capture/adapters/patchright-browser-launcher.ts';
import { createPerformanceClock } from '../../../src/recording-capture/adapters/performance-clock.ts';
import type { SessionSignal } from '../../../src/recording-capture/application/ports/browser-launcher.ts';
import { IN_PAGE_BUNDLE_PATH } from '../../support/build-in-page-bundle.ts';
import { LOGIN_COOKIE, startLoginSite } from '../../support/login-site.ts';
import type { LoginSite } from '../../support/login-site.ts';
import { removeDir } from '../../support/remove-dir.ts';

const WAIT = { timeout: 10_000, interval: 50 };

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
    await Promise.all(directories.map((dir) => removeDir(dir)));
  });

  it('keeps a login across two launches on the same managed directory', async () => {
    const managed = await newProfileDir();
    await visit(managed, '/login');
    await visit(managed, '/whoami');
    expect(site.cookiesSeen.at(-1)).toBe(LOGIN_COOKIE);
  });

  it('does not leak the login into a different directory', async () => {
    await visit(await newProfileDir(), '/whoami');
    expect(site.cookiesSeen.at(-1)).toBeUndefined();
  });
});
