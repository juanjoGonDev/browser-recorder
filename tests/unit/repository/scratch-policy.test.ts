import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const TESTS_ROOT = path.resolve(import.meta.dirname, '..', '..');
/** A statement that builds a path to the repository's own `recordings`. */
const REAL_RECORDINGS_PATH =
  /(?:\bROOT\b|\bREPO_ROOT\b|import\.meta\.dirname)[^;]*['"]recordings['"]/u;
/** Files that may name it: read-only checks that the folder is left alone. */
const ALLOWED = new Set([
  'e2e/cli-replay.test.ts',
  'unit/repository/scratch-policy.test.ts',
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'fixtures' ? [] : sourceFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

describe('test scratch policy', () => {
  it('no test or support file builds a path into the real recordings folder', () => {
    const offenders = sourceFiles(TESTS_ROOT)
      .map((file) => path.relative(TESTS_ROOT, file).split(path.sep).join('/'))
      .filter((relative) => !ALLOWED.has(relative))
      .filter((relative) =>
        readFileSync(path.join(TESTS_ROOT, relative), 'utf8')
          .split(';')
          .some((statement) => REAL_RECORDINGS_PATH.test(statement)),
      );
    expect(offenders).toStrictEqual([]);
  });
});
