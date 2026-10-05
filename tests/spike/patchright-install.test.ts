import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'patchright';
import { describe, expect, it } from 'vitest';

interface Manifest {
  readonly version: string;
  readonly bin?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
}

const requireFromHere = createRequire(import.meta.url);
const PATCHRIGHT_VERSION = '1.63.0';
// The `ms-playwright` folder name is kept by the fork, so one browser cache
// serves both libraries.
const CACHE_FOLDER = 'ms-playwright';

function readManifest(request: string, from: NodeJS.Require): Manifest {
  return JSON.parse(readFileSync(from.resolve(request), 'utf8')) as Manifest;
}

// `patchright-core` is a dependency of `patchright`, not of this repository,
// so it is only reachable through the package that owns it.
const patchrightRequire = createRequire(
  requireFromHere.resolve('patchright/package.json'),
);

describe('S0 spike: the installed Patchright package', () => {
  it('exposes the patchright bin and depends only on patchright-core', () => {
    const manifest = readManifest('patchright/package.json', requireFromHere);

    expect(manifest.version).toBe(PATCHRIGHT_VERSION);
    expect(manifest.bin).toEqual({ patchright: 'cli.js' });
    expect(manifest.dependencies).toEqual({
      'patchright-core': PATCHRIGHT_VERSION,
    });
  });

  it('exposes the patchright-core bin through its own manifest', () => {
    const manifest = readManifest(
      'patchright-core/package.json',
      patchrightRequire,
    );

    expect(manifest.bin).toEqual({ 'patchright-core': 'cli.js' });
    expect(manifest.version).toBe(PATCHRIGHT_VERSION);
  });

  it('does not export a CLI subpath, so the CLI is found through package.json', () => {
    expect(() => requireFromHere.resolve('patchright/cli')).toThrow(
      /not defined by "exports"|Cannot find module/,
    );
  });

  it('looks for browsers under the shared ms-playwright cache folder', () => {
    const executable = chromium.executablePath();

    expect(executable.split(path.sep)).toContain(CACHE_FOLDER);
  });
});

describe('S0 spike: the Chromium switches Patchright passes by default', () => {
  const bundle = readFileSync(
    patchrightRequire.resolve('patchright-core/lib/coreBundle'),
    'utf8',
  );
  const switches = bundle.slice(
    bundle.indexOf('chromiumSwitches = ('),
    bundle.indexOf('"--disable-blink-features=AutomationControlled"'),
  );

  it('still adds --use-mock-keychain and --password-store=basic', () => {
    expect(switches).toContain('"--use-mock-keychain"');
    expect(switches).toContain('"--password-store=basic"');
  });

  it('adds the AutomationControlled switch and never --enable-automation', () => {
    expect(bundle).toContain('"--disable-blink-features=AutomationControlled"');
    expect(bundle).toContain('ignoreDefaultArgs: ["--enable-automation"]');
    expect(switches).not.toContain('"--enable-automation"');
  });
});
