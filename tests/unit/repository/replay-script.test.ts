import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MANIFEST = path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'package.json',
);

interface Manifest {
  readonly scripts: Record<string, string>;
  readonly dependencies: Record<string, string>;
  readonly bin: Record<string, string>;
}

function manifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
}

describe('package.json replay alias', () => {
  it('builds quietly and runs the replay subcommand of the one binary', () => {
    const { scripts, bin } = manifest();
    expect(scripts['replay']).toBe(
      'pnpm run --silent build && node dist/main.js replay',
    );
    expect(bin['browser-recorder']).toBe('dist/main.js');
  });

  it('forwards its arguments to the command, untouched, through pnpm', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'br-alias-'));
    try {
      mkdirSync(path.join(root, 'dist'));
      writeFileSync(
        path.join(root, 'dist', 'main.js'),
        'process.stdout.write(JSON.stringify(process.argv.slice(2)));',
      );
      // The real `replay` script; only the build step is a no-op here.
      writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({
          name: 'alias-probe',
          scripts: { build: 'node -e 0', replay: manifest().scripts['replay'] },
        }),
      );
      const run = spawnSync(
        'pnpm',
        ['-s', 'replay', 'My Flow', '-r', '-d', '900-250'],
        { cwd: root, encoding: 'utf8' },
      );
      expect(run.status).toBe(0);
      expect(JSON.parse(run.stdout) as string[]).toStrictEqual([
        'replay',
        'My Flow',
        '-r',
        '-d',
        '900-250',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('adds no runtime dependency beside Patchright', () => {
    expect(Object.keys(manifest().dependencies)).toStrictEqual(['patchright']);
  });
});
