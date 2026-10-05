import { joinPath } from '../domain/profile-layout.ts';
import { parseSingletonLock } from '../domain/singleton-lock.ts';
import type { ProcessProbe } from './ports/process-probe.ts';
import type { ProfileFileSystem } from './ports/profile-file-system.ts';

export type LockState =
  | { readonly kind: 'free' }
  | { readonly kind: 'locked'; readonly pid: number | null };

export interface ProfileLockDeps {
  readonly fs: ProfileFileSystem;
  readonly processes: ProcessProbe;
  readonly platform: string;
}

const FREE: LockState = { kind: 'free' };

async function checkWindowsLock(
  deps: ProfileLockDeps,
  directory: string,
): Promise<LockState> {
  // Chromium deletes `lockfile` when it closes, so its presence is the lock.
  const isHeld = await deps.fs.exists(
    joinPath(deps.platform, directory, 'lockfile'),
  );
  return isHeld ? { kind: 'locked', pid: null } : FREE;
}

async function checkPosixLock(
  deps: ProfileLockDeps,
  directory: string,
): Promise<LockState> {
  const target = await deps.fs.readLink(
    joinPath(deps.platform, directory, 'SingletonLock'),
  );
  const owner = target === null ? null : parseSingletonLock(target);
  if (owner === null) return FREE;
  // A lock from another host cannot be probed: assume it is alive.
  const isOtherHost = owner.host !== deps.processes.hostname();
  const isAlive = isOtherHost || deps.processes.isAlive(owner.pid);
  return isAlive ? { kind: 'locked', pid: owner.pid } : FREE;
}

/**
 * Whether another live process holds `directory`. A lock left behind by a
 * crashed browser (its owner is gone) is stale and counts as free.
 */
export function checkProfileLock(
  deps: ProfileLockDeps,
  directory: string,
): Promise<LockState> {
  return deps.platform === 'win32'
    ? checkWindowsLock(deps, directory)
    : checkPosixLock(deps, directory);
}
