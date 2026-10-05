import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'patchright';
import type { BrowserContext } from 'patchright';

export interface PersistentBrowser {
  readonly context: BrowserContext;
  /** The temporary user data directory the browser runs on. */
  readonly userDataDir: string;
  /** Closes the context and deletes its directory; safe to call twice. */
  readonly dispose: () => Promise<void>;
}

export interface PersistentOptions {
  /** Headless unless a test explicitly needs a headed browser. */
  readonly isHeadless?: boolean;
  readonly args?: readonly string[];
  readonly viewport?: { width: number; height: number } | null;
}

/**
 * A persistent Chromium context the way the recorder launches it, on a fresh
 * temporary profile directory. Tests start sessions on top of it.
 */
export async function launchPersistent(
  options: PersistentOptions = {},
): Promise<PersistentBrowser> {
  const userDataDir = await mkdtemp(join(tmpdir(), 'br-test-profile-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: options.isHeadless ?? true,
    viewport: options.viewport ?? { width: 1280, height: 800 },
    ...(options.args === undefined ? {} : { args: [...options.args] }),
  });
  return {
    context,
    userDataDir,
    async dispose() {
      await context.close().catch(() => undefined);
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}
