import type { SessionGuard } from './session-guard.ts';

/** Windows keeps a directory busy for a moment after the browser exits. */
const REMOVE_RETRIES = 5;
const REMOVE_RETRY_DELAY_MS = 100;

export interface ReleaseDeps {
  readonly guard: SessionGuard;
  readonly sleep: (ms: number) => Promise<void>;
}

/**
 * Deletes a session directory, retrying while it is busy. A directory that
 * stays busy is left for the next startup sweep: releasing never throws, so a
 * cleanup problem cannot hide the result of the session itself.
 */
export async function removeSession(
  deps: ReleaseDeps,
  path: string,
): Promise<void> {
  for (let retry = 0; retry <= REMOVE_RETRIES; retry += 1) {
    try {
      await deps.guard.remove(path);
      return;
    } catch {
      if (retry < REMOVE_RETRIES) await deps.sleep(REMOVE_RETRY_DELAY_MS);
    }
  }
}

/** A `release` that deletes `path` once, however often it is called. */
export function releaseOnce(
  deps: ReleaseDeps,
  path: string,
): () => Promise<void> {
  let pending: Promise<void> | null = null;
  return () => {
    pending ??= removeSession(deps, path);
    return pending;
  };
}
