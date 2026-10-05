import { readFileSync } from 'node:fs';
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

  it('leaves its arguments to the end so `pnpm replay demo -r` reaches the command', () => {
    const script = manifest().scripts['replay'] ?? '';
    expect(script.endsWith(' replay')).toBe(true);
    expect(`${script} demo -r`).toBe(
      'pnpm run --silent build && node dist/main.js replay demo -r',
    );
  });

  it('adds no runtime dependency beside Patchright', () => {
    expect(Object.keys(manifest().dependencies)).toStrictEqual(['patchright']);
  });
});
