import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { snapshotTree } from '../../support/tree-snapshot.ts';

describe('tests/support/tree-snapshot.ts', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'tree-snapshot-'));
    await mkdir(path.join(root, 'sub'));
    await writeFile(path.join(root, 'a.txt'), 'alpha');
    await writeFile(path.join(root, 'sub', 'b.txt'), 'beta');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('lists every file with a relative path, a hash and its size, sorted', async () => {
    const snapshot = await snapshotTree(root);

    expect(snapshot.map((entry) => entry.path)).toEqual(['a.txt', 'sub/b.txt']);
    expect(snapshot.map((entry) => entry.size)).toEqual([5, 4]);
    expect(snapshot[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot[0]?.sha256).not.toBe(snapshot[1]?.sha256);
  });

  it('is equal when nothing changed', async () => {
    expect(await snapshotTree(root)).toEqual(await snapshotTree(root));
  });

  it('notices changed content, a changed modification time and a new file', async () => {
    const before = await snapshotTree(root);

    await writeFile(path.join(root, 'a.txt'), 'ALPHA');
    const edited = await snapshotTree(root);
    expect(edited).not.toEqual(before);

    await utimes(path.join(root, 'sub', 'b.txt'), 1, 1);
    expect(await snapshotTree(root)).not.toEqual(edited);

    await writeFile(path.join(root, 'c.txt'), 'gamma');
    expect((await snapshotTree(root)).map((entry) => entry.path)).toContain(
      'c.txt',
    );
  });

  it('rejects a directory that does not exist', async () => {
    await expect(snapshotTree(path.join(root, 'missing'))).rejects.toThrow();
  });
});
