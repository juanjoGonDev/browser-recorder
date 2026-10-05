import { spawnSync } from 'node:child_process';
import {
  chmod,
  cp,
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
import { nodeProfileFileSystem } from '../../../src/browser-profiles/adapters/node-profile-file-system.ts';
import {
  createProfileStore,
  type PrepareProfileRequest,
} from '../../../src/browser-profiles/application/profile-store.ts';
import { ProfileInUseError } from '../../../src/browser-profiles/domain/profile-errors.ts';
import { createProfileLayout } from '../../../src/browser-profiles/domain/profile-layout.ts';
import { BRAVE_LIKE_PROFILE } from '../../support/profile-fixtures.ts';
import { snapshotTree } from '../../support/tree-snapshot.ts';

const isPosix = process.platform !== 'win32';
const PRIVATE_MODE = 0o700;

let workDir = '';
let realDir = '';
let appRoot = '';
// Taken when the file loads, before any test ran.
const fixtureAtStart = snapshotTree(BRAVE_LIKE_PROFILE);

function createStore() {
  return createProfileStore({
    fs: nodeProfileFileSystem,
    processes: nodeProcessProbe,
    platform: process.platform,
    layout: createProfileLayout(process.platform, appRoot),
    sleep: () => Promise.resolve(),
  });
}

function copyRequest(sourceProfile: string): PrepareProfileRequest {
  return {
    browserId: 'brave',
    profileMode: 'copy-of-real',
    sourceProfile,
    realUserDataDir: realDir,
  };
}

function deadPid(): number {
  const child = spawnSync(process.execPath, ['-e', '0']);
  return child.pid;
}

describe('profile store on the brave-like fixture', () => {
  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'browser-recorder-store-'));
    realDir = join(workDir, 'real-brave');
    appRoot = join(workDir, 'app-data');
    // The fixture is copied: the store only ever sees a temporary directory.
    await cp(BRAVE_LIKE_PROFILE, realDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('lists the profiles of the fixture Local State', async () => {
    expect(await createStore().listRealProfiles(realDir)).toEqual({
      profiles: [
        { directory: 'Default', displayName: 'Person 1' },
        { directory: 'Profile 1', displayName: 'Work' },
      ],
      hasAppBoundEncryption: false,
    });
  });

  it('copies a profile, leaving the source tree byte and mtime identical', async () => {
    const before = await snapshotTree(realDir);
    const profile = await createStore().prepare(copyRequest('Default'));
    expect(profile.userDataDir.startsWith(appRoot)).toBe(true);
    expect(profile.browserArgs).toEqual(['--profile-directory=Default']);
    const copied = await snapshotTree(profile.userDataDir);
    const paths = copied.map((entry) => entry.path);
    expect(paths).toEqual([
      'Default/Cookies',
      'Default/Cookies-wal',
      'Default/Preferences',
      'Local State',
    ]);
    const cookiesWal = copied.find((e) => e.path === 'Default/Cookies-wal');
    const sourceWal = before.find((e) => e.path === 'Default/Cookies-wal');
    expect(cookiesWal?.sha256).toBe(sourceWal?.sha256);
    expect(await snapshotTree(realDir)).toEqual(before);
    await profile.release();
    await expect(lstat(profile.userDataDir)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await snapshotTree(realDir)).toEqual(before);
  });

  it.skipIf(!isPosix)('keeps the copy private to the user', async () => {
    const profile = await createStore().prepare(copyRequest('Profile 1'));
    for (const folder of [
      profile.userDataDir,
      join(profile.userDataDir, 'Profile 1'),
    ]) {
      expect((await lstat(folder)).mode & 0o777).toBe(PRIVATE_MODE);
    }
    await profile.release();
  });

  it.skipIf(!isPosix)(
    'does not copy a SingletonLock and leaves it in place',
    async () => {
      const lock = join(realDir, 'SingletonLock');
      await symlink(`${hostname()}-${String(process.pid)}`, lock);
      const profile = await createStore().prepare(copyRequest('Default'));
      expect(profile.warnings).toEqual([{ code: 'source-running' }]);
      await expect(
        lstat(join(profile.userDataDir, 'SingletonLock')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      expect((await lstat(lock)).isSymbolicLink()).toBe(true);
      await profile.release();
    },
  );

  it.skipIf(!isPosix)('ignores a SingletonLock of a dead process', async () => {
    await symlink(
      `${hostname()}-${String(deadPid())}`,
      join(realDir, 'SingletonLock'),
    );
    const profile = await createStore().prepare(copyRequest('Default'));
    expect(profile.warnings).toEqual([]);
    await profile.release();
  });

  it.skipIf(!isPosix || process.getuid?.() === 0)(
    'leaves the source untouched and no copy behind when a file cannot be read',
    async () => {
      const cookies = join(realDir, 'Default', 'Cookies');
      const before = await snapshotTree(realDir);
      await chmod(cookies, 0o000);
      await expect(
        createStore().prepare(copyRequest('Default')),
      ).rejects.toMatchObject({ code: 'EACCES' });
      await chmod(cookies, 0o644);
      expect(await snapshotTree(realDir)).toEqual(before);
      const sessions = join(appRoot, 'profiles', 'brave', 'sessions');
      expect(await nodeProfileFileSystem.list(sessions)).toEqual([]);
    },
  );

  it('refuses a profile that is not listed, before copying anything', async () => {
    const before = await snapshotTree(realDir);
    await expect(
      createStore().prepare(copyRequest('Profile 9')),
    ).rejects.toMatchObject({ code: 'unknown-profile' });
    expect(await snapshotTree(realDir)).toEqual(before);
  });

  it('refuses a managed directory locked by a live process', async () => {
    const store = createStore();
    const managed = await store.prepare({
      browserId: 'brave',
      profileMode: 'managed',
      sourceProfile: null,
      realUserDataDir: null,
    });
    if (isPosix) {
      await symlink(
        `${hostname()}-${String(process.pid)}`,
        join(managed.userDataDir, 'SingletonLock'),
      );
      await expect(
        store.prepare({
          browserId: 'brave',
          profileMode: 'managed',
          sourceProfile: null,
          realUserDataDir: null,
        }),
      ).rejects.toBeInstanceOf(ProfileInUseError);
    }
    expect((await lstat(managed.userDataDir)).isDirectory()).toBe(true);
  });

  it('reports no encryption warning for a Local State without an app-bound key', async () => {
    const profile = await createStore().prepare(copyRequest('Default'));
    expect(
      profile.warnings.some((w) => w.code === 'app-bound-encryption'),
    ).toBe(false);
    await profile.release();
  });

  it('flags the app-bound key the way Windows needs it', async () => {
    const info = await createStore().listRealProfiles(realDir);
    expect(info?.hasAppBoundEncryption).toBe(false);
    const localState = join(realDir, 'Local State');
    const text = (await readFile(localState, 'utf8')).replace(
      '"encrypted_key"',
      '"app_bound_encrypted_key"',
    );
    await writeFile(localState, text);
    expect(
      (await createStore().listRealProfiles(realDir))?.hasAppBoundEncryption,
    ).toBe(true);
    const profile = await createStore().prepare(copyRequest('Default'));
    expect(
      profile.warnings.some((w) => w.code === 'app-bound-encryption'),
    ).toBe(process.platform === 'win32');
    await profile.release();
  });

  it('removes leftover sessions at startup and keeps the managed profile', async () => {
    const store = createStore();
    const managed = await store.prepare({
      browserId: 'brave',
      profileMode: 'managed',
      sourceProfile: null,
      realUserDataDir: null,
    });
    const leftover = await store.prepare(copyRequest('Default'));
    await store.sweepStaleSessions();
    await expect(lstat(leftover.userDataDir)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect((await lstat(managed.userDataDir)).isDirectory()).toBe(true);
  });

  it('never touched the fixture in the repository', async () => {
    const profile = await createStore().prepare(copyRequest('Default'));
    await profile.release();
    expect(await snapshotTree(BRAVE_LIKE_PROFILE)).toEqual(
      await fixtureAtStart,
    );
  });
});
