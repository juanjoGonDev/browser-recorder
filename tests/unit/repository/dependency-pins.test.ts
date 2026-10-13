import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

type Manifest = Partial<
  Record<(typeof DEPENDENCY_SECTIONS)[number], Record<string, string>>
>;

function findInexactVersions(manifest: Manifest): string[] {
  const offenders: string[] = [];
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (!EXACT_VERSION.test(version)) {
        offenders.push(`${section}:${name}@${version}`);
      }
    }
  }
  return offenders;
}

function readManifest(): Manifest {
  return JSON.parse(
    readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
  ) as Manifest;
}

function readNpmrc(): Map<string, string> {
  const entries = new Map<string, string>();
  const text = readFileSync(path.join(ROOT, '.npmrc'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const [key = '', ...rest] = trimmed.split('=');
    entries.set(key.trim(), rest.join('=').trim());
  }
  return entries;
}

function readPnpmWorkspaceConfig(): Map<string, string> {
  const entries = new Map<string, string>();
  const text = readFileSync(path.join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = /^(\w+):\s*(.*)$/.exec(line);
    if (match) entries.set(match[1], match[2]);
  }
  return entries;
}

describe('findInexactVersions', () => {
  it('reports caret, tilde and range specifiers with their section', () => {
    const offenders = findInexactVersions({
      dependencies: { patchright: '^1.63.0' },
      devDependencies: { vitest: '~5.0.1', eslint: '>=10.0.0', knip: '6.37.0' },
    });
    expect(offenders).toEqual([
      'dependencies:patchright@^1.63.0',
      'devDependencies:vitest@~5.0.1',
      'devDependencies:eslint@>=10.0.0',
    ]);
  });

  it('accepts exact versions only', () => {
    expect(
      findInexactVersions({ devDependencies: { knip: '6.37.0' } }),
    ).toEqual([]);
  });
});

describe('package.json dependency hygiene', () => {
  it('declares every dependency with an exact version', () => {
    expect(findInexactVersions(readManifest())).toEqual([]);
  });

  it('keeps patchright as the only runtime dependency', () => {
    expect(Object.keys(readManifest().dependencies ?? {})).toEqual([
      'patchright',
    ]);
  });

  it.each(['playwright', 'playwright-core', '@playwright/test'])(
    'does not declare %s in any dependency section',
    (name) => {
      const manifest = readManifest();
      for (const section of DEPENDENCY_SECTIONS) {
        expect(Object.keys(manifest[section] ?? {})).not.toContain(name);
      }
    },
  );

  it('pins patchright to the audited version', () => {
    expect(readManifest().dependencies?.['patchright']).toBe('1.63.0');
  });

  it('allows only the minimal set of dependency build scripts', () => {
    const pnpmConfig = (
      JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
        pnpm?: { onlyBuiltDependencies?: string[] };
      }
    ).pnpm;
    const allowed = pnpmConfig?.onlyBuiltDependencies ?? [];
    expect(allowed).toContain('lefthook');
    expect(allowed.length).toBeLessThanOrEqual(2);
  });
});

describe('pnpm workspace security settings', () => {
  it.each([
    ['minimumReleaseAge', '4320'],
    ['preferFrozenLockfile', 'true'],
    ['verifyStoreIntegrity', 'true'],
    ['verifyDepsBeforeRun', 'warn'],
    ['autoInstallPeers', 'true'],
    ['strictPeerDependencies', 'false'],
  ])('sets %s=%s', (key, value) => {
    expect(readPnpmWorkspaceConfig().get(key)).toBe(value);
  });

  it('keeps npm-compatible settings in .npmrc', () => {
    expect(readNpmrc().get('save-exact')).toBe('true');
    expect(readNpmrc().get('engine-strict')).toBe('true');
  });

  it('keeps pnpm-only keys out of .npmrc', () => {
    const npmrc = readNpmrc();
    expect(npmrc.has('minimum-release-age')).toBe(false);
    expect(npmrc.has('prefer-frozen-lockfile')).toBe(false);
    expect(npmrc.has('verify-store-integrity')).toBe(false);
    expect(npmrc.has('verify-deps-before-run')).toBe(false);
    expect(npmrc.has('auto-install-peers')).toBe(false);
    expect(npmrc.has('strict-peer-dependencies')).toBe(false);
  });

  it('does not use the hoisted linker (only Electron packaging needed it)', () => {
    expect(readNpmrc().has('node-linker')).toBe(false);
  });
});
