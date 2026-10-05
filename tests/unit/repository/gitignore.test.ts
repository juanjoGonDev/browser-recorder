import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

function isIgnored(target: string): boolean {
  const result = spawnSync('git', ['check-ignore', '--quiet', target], {
    cwd: ROOT,
  });
  return result.status === 0;
}

describe('.gitignore', () => {
  it.each([
    'recordings/x/script.mjs',
    'recordings/x/recording.json',
    '.test-scratch/build-out-x/script.mjs',
    'dist/main.js',
    'script.json.123.abc.tmp',
    'node_modules/.bin/tsc',
    'coverage/lcov.info',
  ])('ignores %s', (target) => {
    expect(isIgnored(target)).toBe(true);
  });

  it.each([
    'src/main.ts',
    'package.json',
    'tests/fixtures/site/button.html',
    'AGENTS.md',
  ])('does not ignore %s', (target) => {
    expect(isIgnored(target)).toBe(false);
  });
});
