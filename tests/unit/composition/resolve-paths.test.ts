import { existsSync, readFileSync } from 'node:fs';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findPackageRoot,
  resolveAppPaths,
} from '../../../src/composition/resolve-paths.ts';
import type { PathDeps } from '../../../src/composition/resolve-paths.ts';

let scratch: string;

function writeText(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function installPackage(name: string): string {
  const root = path.join(scratch, 'pkg');
  writeText(path.join(root, 'package.json'), JSON.stringify({ name }));
  return root;
}

function depsWithCli(cli: string, overrides: Partial<PathDeps> = {}): PathDeps {
  return {
    readText: (file) => readFileSync(file, 'utf8'),
    exists: existsSync,
    resolveCli: () => cli,
    platform: 'darwin',
    environment: {},
    homeDirectory: '/Users/ana',
    ...overrides,
  };
}

describe('src/composition/resolve-paths.ts', () => {
  beforeEach(() => {
    scratch = mkdtempSync(path.join(tmpdir(), 'resolve-paths-'));
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('finds the package root above the built entry point', () => {
    const root = installPackage('browser-recorder');
    const entry = pathToFileURL(path.join(root, 'dist', 'main.js')).href;
    const paths = resolveAppPaths(entry, depsWithCli('/cli.js'));
    expect(paths.packageRoot).toBe(root);
  });

  it('finds it from a module nested deeper too', () => {
    const root = installPackage('browser-recorder');
    const nested = pathToFileURL(
      path.join(root, 'dist', 'composition', 'x.js'),
    ).href;
    expect(resolveAppPaths(nested, depsWithCli('/cli.js')).packageRoot).toBe(
      root,
    );
  });

  it('derives the recordings root, the capture script and the Patchright CLI', () => {
    const root = installPackage('browser-recorder');
    const entry = pathToFileURL(path.join(root, 'dist', 'main.js')).href;
    expect(resolveAppPaths(entry, depsWithCli('/the/cli.js'))).toEqual({
      packageRoot: root,
      recordingsRoot: path.join(root, 'recordings'),
      inPageScriptPath: path.join(root, 'dist', 'in-page', 'capture-script.js'),
      patchrightCliPath: '/the/cli.js',
      appDataRoot: '/Users/ana/Library/Application Support/browser-recorder',
    });
  });

  it.each([
    {
      platform: 'linux',
      environment: { XDG_DATA_HOME: '/data' },
      homeDirectory: '/home/ana',
      expected: '/data/browser-recorder',
    },
    {
      platform: 'linux',
      environment: {},
      homeDirectory: '/home/ana',
      expected: '/home/ana/.local/share/browser-recorder',
    },
    {
      platform: 'win32',
      environment: { LOCALAPPDATA: 'C:\\Users\\ana\\AppData\\Local' },
      homeDirectory: 'C:\\Users\\ana',
      expected: 'C:\\Users\\ana\\AppData\\Local\\browser-recorder',
    },
  ])(
    'puts the tool-owned data under the OS app-data directory on $platform',
    ({ expected, ...overrides }) => {
      const root = installPackage('browser-recorder');
      const entry = pathToFileURL(path.join(root, 'dist', 'main.js')).href;
      const paths = resolveAppPaths(entry, depsWithCli('/cli.js', overrides));
      expect(paths.appDataRoot).toBe(expected);
    },
  );

  it('skips a package.json that belongs to another package', () => {
    const outer = path.join(scratch, 'outer');
    writeText(
      path.join(outer, 'package.json'),
      JSON.stringify({ name: 'browser-recorder' }),
    );
    writeText(
      path.join(outer, 'node_modules', 'other', 'package.json'),
      JSON.stringify({ name: 'other' }),
    );
    const entry = pathToFileURL(
      path.join(outer, 'node_modules', 'other', 'dist', 'main.js'),
    ).href;
    expect(resolveAppPaths(entry, depsWithCli('/cli.js')).packageRoot).toBe(
      outer,
    );
  });

  it('names the problem when no package root exists', () => {
    const entry = pathToFileURL(path.join(scratch, 'lonely', 'main.js')).href;
    expect(() => resolveAppPaths(entry, depsWithCli('/cli.js'))).toThrow(
      /package root/i,
    );
  });

  it('survives an unreadable or malformed package.json on the way up', () => {
    const root = installPackage('browser-recorder');
    writeText(path.join(root, 'dist', 'package.json'), '{not json');
    const entry = pathToFileURL(path.join(root, 'dist', 'main.js')).href;
    expect(resolveAppPaths(entry, depsWithCli('/cli.js')).packageRoot).toBe(
      root,
    );
  });

  it('exports the package root lookup for the commands that need the manifest', () => {
    const root = installPackage('browser-recorder');
    const nested = path.join(root, 'dist', 'composition');
    expect(findPackageRoot(nested, depsWithCli('/cli.js'))).toBe(root);
    expect(() =>
      findPackageRoot(path.join(scratch, 'lonely'), depsWithCli('/cli.js')),
    ).toThrow(/package root/i);
  });
});
