import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createPatchrightBrowserInstallation,
  type PatchrightInstallationOptions,
} from '../../../src/environment-setup/adapters/patchright-browser-installation.ts';

const WAIT_MS = 15_000;

let dir = '';

async function fakeCli(source: string): Promise<string> {
  const file = join(dir, 'cli with space.js');
  await writeFile(file, source);
  return file;
}

function options(
  cliPath: string,
  overrides: Partial<PatchrightInstallationOptions> = {},
): PatchrightInstallationOptions {
  return {
    cliPath,
    nodePath: process.execPath,
    executablePath: () => join(dir, 'chromium'),
    exists: () => false,
    ...overrides,
  };
}

describe('createPatchrightBrowserInstallation', () => {
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'install-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reports installed from the executable path existing on disk', async () => {
    const probed: string[] = [];
    const installation = createPatchrightBrowserInstallation(
      options('unused', {
        exists: (file) => {
          probed.push(file);
          return true;
        },
      }),
    );

    expect(await installation.isInstalled()).toBe(true);
    expect(probed).toEqual([join(dir, 'chromium')]);
  });

  it('reports missing when the executable is absent', async () => {
    const installation = createPatchrightBrowserInstallation(options('unused'));

    expect(await installation.isInstalled()).toBe(false);
  });

  it(
    'spawns node with a fixed argv, no shell, and streams lines live',
    async () => {
      const cli = await fakeCli(
        "console.log('argv ' + JSON.stringify(process.argv.slice(2)));" +
          "setTimeout(() => { console.error('progress 50%'); process.exit(0); }, 20);",
      );
      const lines: string[] = [];

      const result = await createPatchrightBrowserInstallation(
        options(cli),
      ).install((line) => lines.push(line));

      expect(result).toEqual({ exitCode: 0 });
      expect(lines).toContain('argv ["install","chromium"]');
      expect(lines).toContain('progress 50%');
    },
    WAIT_MS,
  );

  it(
    'returns the installer exit code on failure',
    async () => {
      const cli = await fakeCli(
        "console.error('getaddrinfo ENOTFOUND'); process.exit(1);",
      );
      const lines: string[] = [];

      const result = await createPatchrightBrowserInstallation(
        options(cli),
      ).install((line) => lines.push(line));

      expect(result).toEqual({ exitCode: 1 });
      expect(lines).toEqual(['getaddrinfo ENOTFOUND']);
    },
    WAIT_MS,
  );

  it(
    'rejects with the reason when the node binary cannot start',
    async () => {
      const installation = createPatchrightBrowserInstallation(
        options('cli.js', { nodePath: join(dir, 'no-such-node') }),
      );

      await expect(installation.install(() => undefined)).rejects.toThrow(
        /no-such-node/,
      );
    },
    WAIT_MS,
  );
});
