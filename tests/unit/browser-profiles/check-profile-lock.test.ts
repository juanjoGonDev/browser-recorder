import { describe, expect, it } from 'vitest';

import { checkProfileLock } from '../../../src/browser-profiles/application/check-profile-lock.ts';
import {
  fakeProcesses,
  MemoryProfileFileSystem,
} from '../../support/memory-profile-file-system.ts';

const DIR = '/data/brave/managed';

describe('checkProfileLock', () => {
  it('is free when there is no SingletonLock', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addDirectory(DIR);
    const state = await checkProfileLock(
      { fs, processes: fakeProcesses('box', []), platform: 'linux' },
      DIR,
    );
    expect(state).toEqual({ kind: 'free' });
  });

  it('is locked by a live process on this host', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addSymlink(`${DIR}/SingletonLock`, 'box-4242');
    const state = await checkProfileLock(
      { fs, processes: fakeProcesses('box', [4242]), platform: 'darwin' },
      DIR,
    );
    expect(state).toEqual({ kind: 'locked', pid: 4242 });
  });

  it('ignores a stale lock whose owner is gone', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addSymlink(`${DIR}/SingletonLock`, 'box-4242');
    const state = await checkProfileLock(
      { fs, processes: fakeProcesses('box', [1]), platform: 'linux' },
      DIR,
    );
    expect(state).toEqual({ kind: 'free' });
  });

  it('treats a lock taken on another host as locked, whatever the pid', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addSymlink(`${DIR}/SingletonLock`, 'other-4242');
    const state = await checkProfileLock(
      { fs, processes: fakeProcesses('box', []), platform: 'linux' },
      DIR,
    );
    expect(state).toEqual({ kind: 'locked', pid: 4242 });
  });

  it('ignores a lock whose target cannot be read as host-pid', async () => {
    const fs = new MemoryProfileFileSystem();
    fs.addSymlink(`${DIR}/SingletonLock`, 'garbage');
    const state = await checkProfileLock(
      { fs, processes: fakeProcesses('box', []), platform: 'linux' },
      DIR,
    );
    expect(state).toEqual({ kind: 'free' });
  });

  it('uses the lockfile on Windows', async () => {
    const fs = new MemoryProfileFileSystem();
    const deps = {
      fs,
      processes: fakeProcesses('box', []),
      platform: 'win32',
    };
    const winDir = 'C:\\data\\brave\\managed';
    expect(await checkProfileLock(deps, winDir)).toEqual({ kind: 'free' });
    fs.nodes.set(`${winDir}\\lockfile`, {
      kind: 'file',
      content: '',
      mtimeMs: 1,
    });
    expect(await checkProfileLock(deps, winDir)).toEqual({
      kind: 'locked',
      pid: null,
    });
  });
});
