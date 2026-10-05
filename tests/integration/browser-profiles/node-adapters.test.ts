import { spawnSync } from 'node:child_process';
import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeProcessProbe } from '../../../src/browser-profiles/adapters/node-process-probe.ts';
import { nodeProfileFileSystem as fsAdapter } from '../../../src/browser-profiles/adapters/node-profile-file-system.ts';

const isPosix = process.platform !== 'win32';
const PRIVATE_MODE = 0o700;

let dir = '';

async function modeOf(path: string): Promise<number> {
  return (await lstat(path)).mode & 0o777;
}

describe('nodeProfileFileSystem', () => {
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'browser-recorder-adapters-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates nested directories and accepts one that already exists', async () => {
    const nested = join(dir, 'a', 'b', 'c');
    await fsAdapter.makePrivateDir(nested);
    await fsAdapter.makePrivateDir(nested);
    expect((await lstat(nested)).isDirectory()).toBe(true);
  });

  it.skipIf(!isPosix)('creates nested directories with mode 0700', async () => {
    const nested = join(dir, 'a', 'b', 'c');
    await fsAdapter.makePrivateDir(nested);
    expect(await modeOf(nested)).toBe(PRIVATE_MODE);
    expect(await modeOf(join(dir, 'a'))).toBe(PRIVATE_MODE);
  });

  it.skipIf(!isPosix)('tightens a directory that already exists', async () => {
    const existing = join(dir, 'open');
    await fsAdapter.makePrivateDir(existing);
    await chmod(existing, 0o755);
    await fsAdapter.makePrivateDir(existing);
    expect(await modeOf(existing)).toBe(PRIVATE_MODE);
  });

  it('reads text, stamps and probes existence', async () => {
    const file = join(dir, 'f.txt');
    await writeFile(file, 'hello');
    expect(await fsAdapter.readText(file)).toBe('hello');
    expect(await fsAdapter.stamp(file)).toMatchObject({ size: 5 });
    expect(await fsAdapter.exists(file)).toBe(true);
    expect(await fsAdapter.exists(join(dir, 'nope'))).toBe(false);
    expect(await fsAdapter.stamp(join(dir, 'nope'))).toBeNull();
    expect(await fsAdapter.stamp(dir)).toBeNull();
  });

  it('lists files and directories and reads no link from a plain entry', async () => {
    await writeFile(join(dir, 'file'), 'x');
    await fsAdapter.makePrivateDir(join(dir, 'folder'));
    expect(await fsAdapter.list(dir)).toEqual([
      { name: 'file', kind: 'file' },
      { name: 'folder', kind: 'directory' },
    ]);
    expect(await fsAdapter.readLink(join(dir, 'file'))).toBeNull();
    expect(await fsAdapter.readLink(join(dir, 'nope'))).toBeNull();
  });

  // Creating a symlink needs extra privileges on Windows.
  it.skipIf(!isPosix)('lists kinds from lstat and reads links', async () => {
    await writeFile(join(dir, 'file'), 'x');
    await fsAdapter.makePrivateDir(join(dir, 'folder'));
    await symlink('somewhere-1', join(dir, 'link'));
    const entries = await fsAdapter.list(dir);
    expect(entries).toEqual([
      { name: 'file', kind: 'file' },
      { name: 'folder', kind: 'directory' },
      { name: 'link', kind: 'symlink' },
    ]);
    expect(await fsAdapter.readLink(join(dir, 'link'))).toBe('somewhere-1');
    expect(await fsAdapter.readLink(join(dir, 'file'))).toBeNull();
    expect(await fsAdapter.readLink(join(dir, 'nope'))).toBeNull();
  });

  it('copies without ever overwriting', async () => {
    const from = join(dir, 'from');
    const to = join(dir, 'to');
    await writeFile(from, 'new');
    await writeFile(to, 'precious');
    await expect(fsAdapter.copyFile(from, to)).rejects.toMatchObject({
      code: 'EEXIST',
    });
    expect(await readFile(to, 'utf8')).toBe('precious');
    const fresh = join(dir, 'fresh');
    await fsAdapter.copyFile(from, fresh);
    expect(await readFile(fresh, 'utf8')).toBe('new');
  });

  it('removes a tree and tolerates a missing path', async () => {
    await fsAdapter.makePrivateDir(join(dir, 'tree', 'deep'));
    await writeFile(join(dir, 'tree', 'deep', 'f'), 'x');
    await fsAdapter.remove(join(dir, 'tree'));
    expect(await fsAdapter.exists(join(dir, 'tree'))).toBe(false);
    await expect(fsAdapter.remove(join(dir, 'tree'))).resolves.toBeUndefined();
  });

  it('hands out different random names', () => {
    expect(fsAdapter.randomName()).not.toBe(fsAdapter.randomName());
    expect(fsAdapter.randomName()).toMatch(/^[\w-]{8,}$/);
  });
});

describe('nodeProcessProbe', () => {
  it('reports the host name of the machine', () => {
    expect(nodeProcessProbe.hostname()).toBe(hostname());
  });

  it('sees this process alive and a finished one gone', () => {
    expect(nodeProcessProbe.isAlive(process.pid)).toBe(true);
    const child = spawnSync(process.execPath, ['-e', '0']);
    expect(child.pid).toBeGreaterThan(0);
    expect(nodeProcessProbe.isAlive(child.pid)).toBe(false);
  });
});
