import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createRunningCheck,
  sleep,
} from '../../../src/composition/profile-runtime.ts';

const DEAD_PID = 2 ** 22 - 1;
let directory = '';

describe('src/composition/profile-runtime.ts', () => {
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'br-runtime-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  describe('createRunningCheck', () => {
    const isPosix = process.platform !== 'win32';

    it.runIf(isPosix)(
      'sees a directory held by a live process on this host',
      async () => {
        await symlink(
          `${hostname()}-${String(process.pid)}`,
          path.join(directory, 'SingletonLock'),
        );
        await expect(
          createRunningCheck(process.platform)(directory),
        ).resolves.toBe(true);
      },
    );

    it.runIf(isPosix)('treats a lock of a dead process as free', async () => {
      await symlink(
        `${hostname()}-${String(DEAD_PID)}`,
        path.join(directory, 'SingletonLock'),
      );
      await expect(
        createRunningCheck(process.platform)(directory),
      ).resolves.toBe(false);
    });

    it('treats a directory without a lock as free', async () => {
      await mkdir(path.join(directory, 'Default'));
      await expect(
        createRunningCheck(process.platform)(directory),
      ).resolves.toBe(false);
    });
  });

  describe('sleep', () => {
    it('resolves after the delay', async () => {
      const startedAt = performance.now();
      await sleep(20);
      expect(performance.now() - startedAt).toBeGreaterThanOrEqual(15);
    });
  });
});
