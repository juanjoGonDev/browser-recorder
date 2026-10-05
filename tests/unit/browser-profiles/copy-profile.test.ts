import { describe, expect, it } from 'vitest';

import { copyProfile } from '../../../src/browser-profiles/application/copy-profile.ts';
import { ProfileCopyError } from '../../../src/browser-profiles/domain/profile-errors.ts';
import {
  errorWithCode,
  MemoryProfileFileSystem,
} from '../../support/memory-profile-file-system.ts';

const SOURCE = '/real/Brave';
const SESSIONS = '/data/brave/sessions';
const COPY = `${SESSIONS}/random1`;

interface Rig {
  readonly fs: MemoryProfileFileSystem;
  readonly sleeps: number[];
  readonly copy: (
    profile?: string,
    known?: readonly string[],
  ) => ReturnType<typeof copyProfile>;
}

function rig(): Rig {
  const fs = new MemoryProfileFileSystem();
  fs.addFile(`${SOURCE}/Local State`, '{"profile":{}}');
  fs.addFile(`${SOURCE}/Default/Preferences`, 'prefs');
  fs.addFile(`${SOURCE}/Default/Cookies`, 'cookies-db');
  fs.addFile(`${SOURCE}/Default/Cookies-wal`, 'cookies-wal');
  const sleeps: number[] = [];
  const sleep = (ms: number): Promise<void> => {
    sleeps.push(ms);
    return Promise.resolve();
  };
  return {
    fs,
    sleeps,
    copy: (profile = 'Default', known = ['Default', 'Profile 2']) =>
      copyProfile(
        { fs, platform: 'linux', sleep },
        {
          sourceRoot: SOURCE,
          profile,
          knownProfiles: known,
          sessionsRoot: SESSIONS,
        },
      ),
  };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return null;
}

describe('copyProfile', () => {
  it('copies Local State, the profile and its WAL sibling byte for byte', async () => {
    const { fs, copy } = rig();
    const result = await copy();
    expect(result).toEqual({ directory: COPY, unstableFiles: [] });
    expect(fs.contentOf(`${COPY}/Local State`)).toBe('{"profile":{}}');
    expect(fs.contentOf(`${COPY}/Default/Cookies`)).toBe('cookies-db');
    expect(fs.contentOf(`${COPY}/Default/Cookies-wal`)).toBe('cookies-wal');
    expect(fs.privateDirs).toContain(`${COPY}/Default`);
  });

  it('skips locks, caches, transient files, symlinks and special files', async () => {
    const { fs, copy } = rig();
    fs.addSymlink(`${SOURCE}/Default/SingletonLock`, 'box-1');
    fs.addFile(`${SOURCE}/Default/Cache/x`, 'cached');
    fs.addFile(`${SOURCE}/Default/Cookies-shm`, 'shm');
    fs.addFile(`${SOURCE}/Default/lockfile`, '');
    fs.addSymlink(`${SOURCE}/Default/link`, '/etc/passwd');
    fs.addFile(`${SOURCE}/Default/Local Storage/leveldb/1.log`, 'kept');
    await copy();
    expect(fs.pathsUnder(COPY)).toEqual([
      `${COPY}/Default`,
      `${COPY}/Default/Cookies`,
      `${COPY}/Default/Cookies-wal`,
      `${COPY}/Default/Local Storage`,
      `${COPY}/Default/Local Storage/leveldb`,
      `${COPY}/Default/Local Storage/leveldb/1.log`,
      `${COPY}/Default/Preferences`,
      `${COPY}/Local State`,
    ]);
  });

  it('never touches another profile of the source', async () => {
    const { fs, copy } = rig();
    fs.addFile(`${SOURCE}/Profile 2/Cookies`, 'other');
    await copy();
    expect(fs.pathsUnder(COPY).some((p) => p.includes('Profile 2'))).toBe(
      false,
    );
  });

  it('retries a torn read and ends with the final bytes', async () => {
    const { fs, sleeps, copy } = rig();
    let isTorn = false;
    fs.onCopy = (from) => {
      if (from.endsWith('Cookies') && !isTorn) {
        isTorn = true;
        fs.touch(from, 'cookies-db-v2');
      }
    };
    const result = await copy();
    expect(sleeps).toEqual([50]);
    expect(result.unstableFiles).toEqual([]);
    expect(fs.contentOf(`${COPY}/Default/Cookies`)).toBe('cookies-db-v2');
  });

  it('treats a changing WAL sibling as a torn read of its database', async () => {
    const { fs, sleeps, copy } = rig();
    let changes = 0;
    fs.onCopy = (from) => {
      if (from.endsWith('Cookies-wal') && changes < 2) {
        changes += 1;
        fs.touch(from, `wal-${String(changes)}`);
      }
    };
    await copy();
    expect(sleeps).toEqual([50, 100]);
    expect(fs.contentOf(`${COPY}/Default/Cookies-wal`)).toBe('wal-2');
  });

  it('reports a file that never settles as an unstable copy', async () => {
    const { fs, sleeps, copy } = rig();
    fs.onCopy = (from) => {
      if (from.endsWith('Default/Cookies'))
        fs.touch(from, String(Math.random()));
    };
    const result = await copy();
    expect(sleeps).toEqual([50, 100, 200]);
    expect(result.unstableFiles).toEqual(['Default/Cookies']);
    expect(fs.contentOf(`${COPY}/Default/Preferences`)).toBe('prefs');
  });

  it('retries a busy file and succeeds when it frees up', async () => {
    const { fs, sleeps, copy } = rig();
    let busy = 1;
    fs.onCopy = (from) => {
      if (from.endsWith('Preferences') && busy > 0) {
        busy -= 1;
        throw errorWithCode('EBUSY');
      }
    };
    await copy();
    expect(sleeps).toEqual([50]);
    expect(fs.contentOf(`${COPY}/Default/Preferences`)).toBe('prefs');
  });

  it.each(['EBUSY', 'EPERM'])(
    'removes the copy and reports source-in-use when %s persists',
    async (code) => {
      const { fs, sleeps, copy } = rig();
      fs.onCopy = (from) => {
        if (from.endsWith('Cookies')) throw errorWithCode(code);
      };
      const error = await rejection(copy());
      expect(error).toBeInstanceOf(ProfileCopyError);
      expect((error as ProfileCopyError).code).toBe('source-in-use');
      expect(sleeps).toEqual([50, 100, 200]);
      expect(fs.removed).toContain(COPY);
      expect(fs.pathsUnder(SESSIONS)).toEqual([]);
    },
  );

  it('removes the copy and rethrows an unexpected failure', async () => {
    const { fs, copy } = rig();
    fs.onCopy = (from) => {
      if (from.endsWith('Cookies')) throw errorWithCode('EIO');
    };
    expect(await rejection(copy())).toMatchObject({ code: 'EIO' });
    expect(fs.pathsUnder(SESSIONS)).toEqual([]);
  });

  it('skips a file that vanished while the profile was walked', async () => {
    const { fs, copy } = rig();
    fs.onCopy = (from) => {
      if (from.endsWith('Preferences')) fs.nodes.delete(from);
    };
    await copy();
    expect(fs.contentOf(`${COPY}/Default/Preferences`)).toBeNull();
    expect(fs.contentOf(`${COPY}/Default/Cookies`)).toBe('cookies-db');
  });

  it.each([
    '../x',
    'Default/../..',
    'C:\\x',
    '/etc',
    'Guest Profile',
    'Profile 7',
  ])('refuses the profile %j before reading anything', async (profile) => {
    const { fs, copy } = rig();
    const error = await rejection(copy(profile));
    expect(error).toBeInstanceOf(ProfileCopyError);
    expect((error as ProfileCopyError).code).toBe('unknown-profile');
    expect(fs.copied).toEqual([]);
    expect(fs.pathsUnder(SESSIONS)).toEqual([]);
  });

  it.each(['Default', 'Local State'])(
    'reports source-missing when %s is not on disk',
    async (missing) => {
      const { fs, copy } = rig();
      fs.nodes.delete(`${SOURCE}/${missing}/Preferences`);
      if (missing === 'Default') {
        for (const path of fs.pathsUnder(`${SOURCE}/Default`))
          fs.nodes.delete(path);
        fs.nodes.delete(`${SOURCE}/Default`);
      } else {
        fs.nodes.delete(`${SOURCE}/Local State`);
      }
      const error = await rejection(copy());
      expect((error as ProfileCopyError).code).toBe('source-missing');
      expect(fs.pathsUnder(SESSIONS)).toEqual([]);
    },
  );
});
