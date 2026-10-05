export interface SingletonOwner {
  readonly host: string;
  readonly pid: number;
}

const OWNER_PATTERN = /^(.+)-(\d+)$/;

/**
 * Chromium's `SingletonLock` is a symlink whose target reads `host-pid`. The
 * host may itself contain dashes, so the pid is whatever follows the last one.
 */
export function parseSingletonLock(target: string): SingletonOwner | null {
  const match = OWNER_PATTERN.exec(target);
  if (match === null) return null;
  const pid = Number(match[2]);
  const host = match[1];
  if (host === undefined || !Number.isSafeInteger(pid) || pid < 1) return null;
  return { host, pid };
}
