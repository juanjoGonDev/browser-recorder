import { open, rename, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const MAX_RENAME_ATTEMPTS = 5;
const RENAME_BACKOFF_MS = 20;
const RANDOM_SUFFIX_BYTES = 4;
// Windows reports a file held by another process (antivirus, indexer) this way.
const RETRYABLE_CODES: ReadonlySet<unknown> = new Set(['EPERM', 'EBUSY']);

export interface WritableHandle {
  writeFile(content: string): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}

export interface AtomicFs {
  openForWrite(path: string): Promise<WritableHandle>;
  rename(from: string, to: string): Promise<void>;
  unlink(path: string): Promise<void>;
}

export interface AtomicWriteOptions {
  readonly fs?: AtomicFs;
  readonly sleep?: (ms: number) => Promise<void>;
}

export const nodeAtomicFs: AtomicFs = {
  openForWrite: (path) => open(path, 'w'),
  rename,
  unlink,
};

function sleepFor(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof Error &&
    RETRYABLE_CODES.has((error as { code?: unknown }).code)
  );
}

/** Renames, retrying the transient Windows lock errors a few times. */
export async function renameWithRetry(
  from: string,
  to: string,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const fs = options.fs ?? nodeAtomicFs;
  const sleep = options.sleep ?? sleepFor;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      if (!isRetryable(error) || attempt >= MAX_RENAME_ATTEMPTS) throw error;
      await sleep(RENAME_BACKOFF_MS);
    }
  }
}

async function writeDurably(
  fs: AtomicFs,
  path: string,
  content: string,
): Promise<void> {
  const handle = await fs.openForWrite(path);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * Writes beside the target then renames over it, so a crash leaves either the
 * old file or the new one and never a torn file.
 */
export async function atomicWriteFile(
  path: string,
  content: string,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const fs = options.fs ?? nodeAtomicFs;
  const random = randomBytes(RANDOM_SUFFIX_BYTES).toString('hex');
  const tempPath = `${path}.${String(process.pid)}.${random}.tmp`;
  try {
    await writeDurably(fs, tempPath, content);
    await renameWithRetry(tempPath, path, options);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }
}
