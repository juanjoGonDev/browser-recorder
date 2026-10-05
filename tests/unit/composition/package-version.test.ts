import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readPackageVersion } from '../../../src/composition/package-version.ts';

const deps = {
  readText: (file: string) => readFileSync(file, 'utf8'),
  exists: existsSync,
};
let scratch: string;

function installPackage(manifest: unknown): string {
  const root = path.join(scratch, 'pkg');
  mkdirSync(path.join(root, 'dist'), { recursive: true });
  writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest));
  return pathToFileURL(path.join(root, 'dist', 'main.js')).href;
}

describe('src/composition/package-version.ts', () => {
  beforeEach(() => {
    scratch = mkdtempSync(path.join(tmpdir(), 'package-version-'));
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it.each(['1.2.3', '0.0.1-rc.1'])(
    'reads version %s from the manifest',
    (version) => {
      const entry = installPackage({ name: 'browser-recorder', version });
      expect(readPackageVersion(entry, deps)).toBe(version);
    },
  );

  it('equals the version of this repository package.json', () => {
    const manifest = JSON.parse(
      readFileSync(
        path.join(import.meta.dirname, '../../../package.json'),
        'utf8',
      ),
    ) as { version: string };
    const entry = pathToFileURL(
      path.join(import.meta.dirname, '../../../src/main.ts'),
    ).href;
    expect(readPackageVersion(entry, deps)).toBe(manifest.version);
  });

  it('fails clearly when the manifest has no version', () => {
    const entry = installPackage({ name: 'browser-recorder' });
    expect(() => readPackageVersion(entry, deps)).toThrow(/version/iu);
  });
});
