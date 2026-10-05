import { nodeProcessProbe } from '../browser-profiles/adapters/node-process-probe.ts';
import { nodeProfileFileSystem } from '../browser-profiles/adapters/node-profile-file-system.ts';
import { checkProfileLock } from '../browser-profiles/application/check-profile-lock.ts';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Whether a live browser holds a user data directory, as the OS sees it. */
export function createRunningCheck(
  platform: string,
): (directory: string) => Promise<boolean> {
  const deps = {
    fs: nodeProfileFileSystem,
    processes: nodeProcessProbe,
    platform,
  };
  return async (directory) =>
    (await checkProfileLock(deps, directory)).kind === 'locked';
}
