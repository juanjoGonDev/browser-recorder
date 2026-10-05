import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  atomicWriteFile,
  nodeAtomicFs,
  type AtomicFs,
} from '../../../src/script-library/adapters/atomic-write-file.ts';

let dir = '';

function busyError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function fsFailingRename(
  failures: number,
  code: string,
): { fs: AtomicFs; attempts: () => number } {
  let attempts = 0;
  const fs: AtomicFs = {
    ...nodeAtomicFs,
    rename: async (from, to) => {
      attempts += 1;
      if (attempts <= failures) throw busyError(code);
      await nodeAtomicFs.rename(from, to);
    },
  };
  return { fs, attempts: () => attempts };
}

describe('atomicWriteFile', () => {
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'atomic-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates the file and leaves no temp file behind', async () => {
    const target = join(dir, 'script.mjs');
    await atomicWriteFile(target, 'hello');
    expect(await readFile(target, 'utf8')).toBe('hello');
    expect(await readdir(dir)).toEqual(['script.mjs']);
  });

  it('replaces existing content', async () => {
    const target = join(dir, 'recording.json');
    await writeFile(target, 'old');
    await atomicWriteFile(target, 'new');
    expect(await readFile(target, 'utf8')).toBe('new');
  });

  it('names the temp file <file>.<pid>.<rand>.tmp in the same directory', async () => {
    const target = join(dir, 'a.json');
    const seen: string[] = [];
    const fs: AtomicFs = {
      ...nodeAtomicFs,
      rename: async (from, to) => {
        seen.push(from);
        await nodeAtomicFs.rename(from, to);
      },
    };
    await atomicWriteFile(target, 'x', { fs });
    expect(seen[0]).toMatch(
      new RegExp(`a\\.json\\.${String(process.pid)}\\.[a-z0-9]+\\.tmp$`),
    );
    expect(seen[0]?.startsWith(dir)).toBe(true);
  });

  it('keeps the old file and removes the temp when rename fails for good', async () => {
    const target = join(dir, 'recording.json');
    await writeFile(target, 'old');
    const { fs } = fsFailingRename(Number.MAX_SAFE_INTEGER, 'EACCES');
    await expect(atomicWriteFile(target, 'new', { fs })).rejects.toThrow(
      'EACCES',
    );
    expect(await readFile(target, 'utf8')).toBe('old');
    expect(await readdir(dir)).toEqual(['recording.json']);
  });

  it.each(['EPERM', 'EBUSY'])(
    'retries a rename failing with %s',
    async (code) => {
      const target = join(dir, 'f.txt');
      const { fs, attempts } = fsFailingRename(4, code);
      const sleep = vi.fn(() => Promise.resolve());
      await atomicWriteFile(target, 'ok', { fs, sleep });
      expect(attempts()).toBe(5);
      expect(sleep).toHaveBeenCalledTimes(4);
      expect(sleep).toHaveBeenCalledWith(20);
      expect(await readFile(target, 'utf8')).toBe('ok');
    },
  );

  it('gives up after 5 attempts on a persistent EBUSY', async () => {
    const target = join(dir, 'f.txt');
    const { fs, attempts } = fsFailingRename(Number.MAX_SAFE_INTEGER, 'EBUSY');
    await expect(
      atomicWriteFile(target, 'ok', { fs, sleep: () => Promise.resolve() }),
    ).rejects.toThrow('EBUSY');
    expect(attempts()).toBe(5);
  });

  it('does not retry other errors', async () => {
    const { fs, attempts } = fsFailingRename(1, 'ENOENT');
    await expect(
      atomicWriteFile(join(dir, 'f.txt'), 'x', { fs }),
    ).rejects.toThrow('ENOENT');
    expect(attempts()).toBe(1);
  });
});
