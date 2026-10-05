import { describe, expect, it } from 'vitest';

import { createProfileStore } from '../../../src/browser-profiles/application/profile-store.ts';
import { createProfileLayout } from '../../../src/browser-profiles/domain/profile-layout.ts';
import {
  ProfileCopyError,
  ProfileInUseError,
} from '../../../src/browser-profiles/domain/profile-errors.ts';
import {
  errorWithCode,
  fakeProcesses,
  MemoryProfileFileSystem,
} from '../../support/memory-profile-file-system.ts';

const ROOT = '/data/browser-recorder';
const REAL = '/real/Brave';

const LOCAL_STATE =
  '{"profile":{"info_cache":{"Default":{"name":"Me"},"Profile 2":{"name":"Work"}}},"os_crypt":{}}';
const APP_BOUND_STATE =
  '{"profile":{"info_cache":{"Default":{"name":"Me"}}},"os_crypt":{"app_bound_encrypted_key":"k"}}';

function rig(platform = 'linux', alivePids: readonly number[] = []) {
  const fs = new MemoryProfileFileSystem();
  const sleeps: number[] = [];
  const store = createProfileStore({
    fs,
    platform,
    processes: fakeProcesses('box', alivePids),
    layout: createProfileLayout(platform, ROOT),
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
  });
  return { fs, store, sleeps };
}

function seedReal(fs: MemoryProfileFileSystem, localState = LOCAL_STATE): void {
  fs.addFile(`${REAL}/Local State`, localState);
  fs.addFile(`${REAL}/Default/Preferences`, 'prefs');
  fs.addFile(`${REAL}/Default/Cookies`, 'cookies');
  fs.addFile(`${REAL}/Default/Cookies-wal`, 'wal');
  fs.addFile(`${REAL}/Default/Cache/x`, 'cached');
}

function copyRequest(sourceProfile: string | null = 'Default') {
  return {
    browserId: 'brave',
    profileMode: 'copy-of-real',
    sourceProfile,
    realUserDataDir: REAL,
  } as const;
}

function snapshot(fs: MemoryProfileFileSystem, root: string): string {
  return JSON.stringify(
    [...fs.nodes.entries()].filter(([path]) => path.startsWith(root)),
  );
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return null;
}

describe('createProfileStore managed profiles', () => {
  const request = (browserId: 'brave' | 'chrome' = 'brave') =>
    ({
      browserId,
      profileMode: 'managed',
      sourceProfile: null,
      realUserDataDir: null,
    }) as const;

  it('creates the directory privately on first use', async () => {
    const { fs, store } = rig();
    const profile = await store.prepare(request());
    expect(profile.userDataDir).toBe(`${ROOT}/profiles/brave/managed`);
    expect(fs.privateDirs).toContain(profile.userDataDir);
    expect(profile).toMatchObject({
      browserArgs: [],
      shouldUseRealKeychain: false,
      warnings: [],
    });
  });

  it('reuses the same directory and leaves its contents untouched', async () => {
    const { fs, store } = rig();
    const first = await store.prepare(request());
    fs.addFile(`${first.userDataDir}/Default/Cookies`, 'login');
    const before = snapshot(fs, first.userDataDir);
    const second = await store.prepare(request());
    await second.release();
    expect(second.userDataDir).toBe(first.userDataDir);
    expect(snapshot(fs, first.userDataDir)).toBe(before);
    expect(fs.removed).toEqual([]);
  });

  it('keeps one directory per browser', async () => {
    const { store } = rig();
    const brave = await store.prepare(request('brave'));
    const chrome = await store.prepare(request('chrome'));
    expect(chrome.userDataDir).not.toBe(brave.userDataDir);
  });

  it('refuses a profile locked by a live process', async () => {
    const { fs, store } = rig('linux', [4242]);
    fs.addSymlink(`${ROOT}/profiles/brave/managed/SingletonLock`, 'box-4242');
    const error = await rejection(store.prepare(request()));
    expect(error).toBeInstanceOf(ProfileInUseError);
    expect(error).toMatchObject({
      browserId: 'brave',
      directory: `${ROOT}/profiles/brave/managed`,
    });
  });

  it('ignores a stale lock', async () => {
    const { fs, store } = rig('linux', []);
    fs.addSymlink(`${ROOT}/profiles/brave/managed/SingletonLock`, 'box-4242');
    await expect(store.prepare(request())).resolves.toMatchObject({
      userDataDir: `${ROOT}/profiles/brave/managed`,
    });
  });
});

describe('createProfileStore ephemeral profiles', () => {
  const request = {
    browserId: 'chrome',
    profileMode: 'ephemeral',
    sourceProfile: null,
    realUserDataDir: null,
  } as const;

  it('gives a fresh private directory and deletes it on release', async () => {
    const { fs, store } = rig();
    const first = await store.prepare(request);
    const second = await store.prepare(request);
    expect(first.userDataDir).toBe(`${ROOT}/profiles/chrome/sessions/random1`);
    expect(second.userDataDir).not.toBe(first.userDataDir);
    expect(fs.privateDirs).toContain(first.userDataDir);
    await first.release();
    expect(await fs.exists(first.userDataDir)).toBe(false);
    expect(await fs.exists(second.userDataDir)).toBe(true);
  });

  it('retries a busy directory 5 times, 100 ms apart, then gives up quietly', async () => {
    const { fs, store, sleeps } = rig();
    const profile = await store.prepare(request);
    fs.onRemove = () => {
      throw errorWithCode('EBUSY');
    };
    await expect(profile.release()).resolves.toBeUndefined();
    expect(sleeps).toEqual([100, 100, 100, 100, 100]);
  });

  it('succeeds when the directory frees up during the retries', async () => {
    const { fs, store, sleeps } = rig();
    const profile = await store.prepare(request);
    let busy = 2;
    fs.onRemove = () => {
      if (busy-- > 0) throw errorWithCode('EBUSY');
    };
    await profile.release();
    expect(sleeps).toEqual([100, 100]);
    expect(await fs.exists(profile.userDataDir)).toBe(false);
  });
});

describe('createProfileStore copy-of-real profiles', () => {
  it('copies into a session directory and launches on the right profile', async () => {
    const { fs, store } = rig();
    seedReal(fs);
    const before = snapshot(fs, REAL);
    const profile = await store.prepare(copyRequest());
    expect(profile.userDataDir).toBe(`${ROOT}/profiles/brave/sessions/random1`);
    expect(profile.browserArgs).toEqual(['--profile-directory=Default']);
    expect(profile.shouldUseRealKeychain).toBe(true);
    expect(profile.warnings).toEqual([]);
    expect(fs.contentOf(`${profile.userDataDir}/Default/Cookies-wal`)).toBe(
      'wal',
    );
    expect(fs.contentOf(`${profile.userDataDir}/Default/Cache/x`)).toBeNull();
    await profile.release();
    expect(await fs.exists(profile.userDataDir)).toBe(false);
    expect(snapshot(fs, REAL)).toBe(before);
  });

  it('warns that the snapshot may be stale while the browser runs', async () => {
    const { fs, store } = rig('linux', [77]);
    seedReal(fs);
    fs.addSymlink(`${REAL}/SingletonLock`, 'box-77');
    const profile = await store.prepare(copyRequest());
    expect(profile.warnings).toEqual([{ code: 'source-running' }]);
    expect(await fs.exists(`${profile.userDataDir}/SingletonLock`)).toBe(false);
  });

  it('does not warn about a stale source lock', async () => {
    const { fs, store } = rig('linux', []);
    seedReal(fs);
    fs.addSymlink(`${REAL}/SingletonLock`, 'box-77');
    expect((await store.prepare(copyRequest())).warnings).toEqual([]);
  });

  it('warns about app-bound encryption on Windows only', async () => {
    const win = rig('win32');
    const winRoot = 'C:\\Real\\Brave';
    win.fs.addFile(`${winRoot}\\Local State`, APP_BOUND_STATE);
    win.fs.addFile(`${winRoot}\\Default\\Preferences`, 'prefs');
    const winRequest = { ...copyRequest(), realUserDataDir: winRoot };
    expect((await win.store.prepare(winRequest)).warnings).toEqual([
      { code: 'app-bound-encryption' },
    ]);
    const linux = rig('linux');
    seedReal(linux.fs, APP_BOUND_STATE);
    expect((await linux.store.prepare(copyRequest())).warnings).toEqual([]);
  });

  it('reports files that kept changing as an unstable copy', async () => {
    const { fs, store } = rig();
    seedReal(fs);
    fs.onCopy = (from) => {
      if (from.endsWith('Default/Cookies'))
        fs.touch(from, String(Math.random()));
    };
    const profile = await store.prepare(copyRequest());
    expect(profile.warnings).toEqual([
      { code: 'unstable-copy', files: ['Default/Cookies'] },
    ]);
  });

  it('refuses a profile that Local State does not list', async () => {
    const { fs, store } = rig();
    seedReal(fs);
    fs.addFile(`${REAL}/Profile 9/Cookies`, 'x');
    for (const name of ['Profile 9', '../x', null]) {
      const error = await rejection(store.prepare(copyRequest(name)));
      expect(error).toBeInstanceOf(ProfileCopyError);
      expect(error).toMatchObject({ code: 'unknown-profile' });
    }
    expect(fs.pathsUnder(`${ROOT}/profiles/brave/sessions`)).toEqual([]);
  });

  it.each([
    ['a missing Local State', undefined],
    ['an invalid Local State', 'not json'],
  ])('reports source-missing for %s', async (_title, text) => {
    const { fs, store } = rig();
    seedReal(fs, text);
    if (text === undefined) fs.nodes.delete(`${REAL}/Local State`);
    const error = await rejection(store.prepare(copyRequest()));
    expect(error).toMatchObject({ code: 'source-missing' });
  });

  it('needs the real directory of the browser', async () => {
    const { store } = rig();
    const error = await rejection(
      store.prepare({ ...copyRequest(), realUserDataDir: null }),
    );
    expect(error).toMatchObject({ code: 'source-missing' });
  });

  it('removes the copy when the source stays busy', async () => {
    const { fs, store } = rig();
    seedReal(fs);
    fs.onCopy = (from) => {
      if (from.endsWith('Cookies')) throw errorWithCode('EBUSY');
    };
    const error = await rejection(store.prepare(copyRequest()));
    expect(error).toMatchObject({ code: 'source-in-use' });
    expect(fs.pathsUnder(`${ROOT}/profiles/brave/sessions`)).toEqual([]);
  });
});

describe('createProfileStore listRealProfiles', () => {
  it('lists the profiles of Local State', async () => {
    const { fs, store } = rig();
    seedReal(fs);
    expect(await store.listRealProfiles(REAL)).toEqual({
      profiles: [
        { directory: 'Default', displayName: 'Me' },
        { directory: 'Profile 2', displayName: 'Work' },
      ],
      hasAppBoundEncryption: false,
    });
  });

  it('returns null and writes nothing when Local State is unusable', async () => {
    const { fs, store } = rig();
    expect(await store.listRealProfiles(REAL)).toBeNull();
    fs.addFile(`${REAL}/Local State`, 'not json');
    expect(await store.listRealProfiles(REAL)).toBeNull();
    expect(fs.removed).toEqual([]);
    expect(fs.copied).toEqual([]);
    expect(fs.privateDirs.size).toBe(0);
  });
});

describe('createProfileStore sweepStaleSessions', () => {
  it('deletes leftover sessions of every browser but keeps managed profiles', async () => {
    const { fs, store } = rig();
    fs.addFile(`${ROOT}/profiles/brave/sessions/old1/Default/Cookies`, 'x');
    fs.addFile(`${ROOT}/profiles/chrome/sessions/old2/Local State`, 'x');
    fs.addFile(`${ROOT}/profiles/brave/managed/Default/Cookies`, 'login');
    await store.sweepStaleSessions();
    expect(fs.pathsUnder(`${ROOT}/profiles/brave/sessions`)).toEqual([]);
    expect(fs.pathsUnder(`${ROOT}/profiles/chrome/sessions`)).toEqual([]);
    expect(fs.contentOf(`${ROOT}/profiles/brave/managed/Default/Cookies`)).toBe(
      'login',
    );
  });

  it('leaves a session whose browser is still running', async () => {
    const { fs, store } = rig('linux', [31]);
    fs.addSymlink(
      `${ROOT}/profiles/brave/sessions/live/SingletonLock`,
      'box-31',
    );
    fs.addFile(`${ROOT}/profiles/brave/sessions/dead/Local State`, 'x');
    await store.sweepStaleSessions();
    expect(await fs.exists(`${ROOT}/profiles/brave/sessions/live`)).toBe(true);
    expect(await fs.exists(`${ROOT}/profiles/brave/sessions/dead`)).toBe(false);
  });

  it('does nothing when there are no sessions yet', async () => {
    const { fs, store } = rig();
    await store.sweepStaleSessions();
    expect(fs.removed).toEqual([]);
  });
});
