import { rmSync } from 'node:fs';
import { rm } from 'node:fs/promises';

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 100;

/**
 * On Windows a browser that has just closed can still hold files of its
 * profile (`chrome_debug.log`, crashpad) for a moment, and unlinking them
 * fails with EBUSY or EPERM. Node retries those errors with a linear backoff.
 */
const REMOVE_OPTIONS = {
  recursive: true,
  force: true,
  maxRetries: MAX_RETRIES,
  retryDelay: RETRY_DELAY_MS,
} as const;

/** Removes a directory a browser may have used; a missing one is fine. */
export async function removeDir(directory: string): Promise<void> {
  await rm(directory, REMOVE_OPTIONS);
}

/** The synchronous form of {@link removeDir}, for synchronous teardowns. */
export function removeDirSync(directory: string): void {
  rmSync(directory, REMOVE_OPTIONS);
}
