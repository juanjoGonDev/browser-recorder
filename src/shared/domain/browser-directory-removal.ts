const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 100;

/**
 * Options for `rm` on a directory a browser may have just used. On Windows a
 * Chromium that has just exited can still hold files such as
 * `chrome_debug.log`, and deleting them fails with EBUSY or EPERM for a
 * moment; Node retries those errors (and ENOTEMPTY) with a linear backoff.
 * The generated script's launch prelude repeats these numbers.
 */
export const BROWSER_DIRECTORY_REMOVAL = {
  recursive: true,
  force: true,
  maxRetries: MAX_RETRIES,
  retryDelay: RETRY_DELAY_MS,
} as const;
