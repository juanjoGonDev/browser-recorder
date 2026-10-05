import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { removeDir, removeDirSync } from '../../support/remove-dir.ts';

function tree(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'remove-dir-'));
  mkdirSync(path.join(root, 'Default'));
  writeFileSync(path.join(root, 'Default', 'chrome_debug.log'), 'log');
  return root;
}

describe('tests/support/remove-dir.ts', () => {
  it('removes a directory and everything inside it', async () => {
    const root = tree();
    await removeDir(root);
    expect(existsSync(root)).toBe(false);
  });

  it('removes a directory synchronously', () => {
    const root = tree();
    removeDirSync(root);
    expect(existsSync(root)).toBe(false);
  });

  it('accepts a directory that is already gone', async () => {
    const root = tree();
    removeDirSync(root);
    await expect(removeDir(root)).resolves.toBeUndefined();
    expect(() => {
      removeDirSync(root);
    }).not.toThrow();
  });
});
