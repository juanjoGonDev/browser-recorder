import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import {
  resolvePlaywrightCli,
  type CliResolverDeps,
} from '../../../src/environment-setup/adapters/resolve-playwright-cli.ts';

const nodeRequire = createRequire(import.meta.url);

const realDeps: CliResolverDeps = {
  resolve: (id) => nodeRequire.resolve(id),
  readText: (file) => readFileSync(file, 'utf8'),
  exists: existsSync,
};

describe('resolvePlaywrightCli', () => {
  it('resolves the real installed patchright CLI to an existing file', () => {
    const cli = resolvePlaywrightCli(realDeps);

    expect(cli).toMatch(/patchright[\\/]cli\.js$/);
    expect(existsSync(cli)).toBe(true);
  });

  it('documents why: the patchright/cli subpath is not exported', () => {
    expect(() => nodeRequire.resolve('patchright/cli')).toThrow(
      /not defined by "exports"/,
    );
  });

  it('falls back to patchright-core when patchright is absent', () => {
    const files: Record<string, string> = {
      '/m/patchright-core/package.json': JSON.stringify({
        bin: { 'patchright-core': 'cli.js' },
      }),
    };
    const cli = resolvePlaywrightCli({
      resolve: (id) => {
        const file = `/m/${id}`;
        if (!(file in files)) throw new Error(`Cannot find module ${id}`);
        return file;
      },
      readText: (file) => files[file] ?? '',
      exists: () => true,
    });

    expect(cli.replaceAll('\\', '/')).toBe('/m/patchright-core/cli.js');
  });

  it('skips a candidate whose CLI file is missing', () => {
    const files: Record<string, string> = {
      '/m/patchright/package.json': JSON.stringify({
        bin: { patchright: 'cli.js' },
      }),
      '/m/patchright-core/package.json': JSON.stringify({
        bin: { 'patchright-core': 'cli.js' },
      }),
    };
    const cli = resolvePlaywrightCli({
      resolve: (id) => `/m/${id}`,
      readText: (file) => files[file] ?? '',
      exists: (file) => file.replaceAll('\\', '/').includes('patchright-core'),
    });

    expect(cli.replaceAll('\\', '/')).toBe('/m/patchright-core/cli.js');
  });

  it('throws a clear error when no candidate resolves', () => {
    expect(() =>
      resolvePlaywrightCli({
        resolve: () => {
          throw new Error('nope');
        },
        readText: () => '',
        exists: () => false,
      }),
    ).toThrow(/Playwright CLI/);
  });

  it('throws when the package declares no usable bin', () => {
    expect(() =>
      resolvePlaywrightCli({
        resolve: (id) => `/m/${id}`,
        readText: () => '{}',
        exists: () => true,
      }),
    ).toThrow(/Playwright CLI/);
  });
});
