import { ProfileCopyError } from '../domain/profile-errors.ts';
import type {
  FileStamp,
  ProfileFileSystem,
} from './ports/profile-file-system.ts';

/** Waits before each retry; the number of delays is the number of retries. */
const RETRY_DELAYS_MS = [50, 100, 200] as const;

const BUSY_CODES = new Set(['EBUSY', 'EPERM']);

export interface CopyContext {
  readonly fs: ProfileFileSystem;
  readonly sleep: (ms: number) => Promise<void>;
  readonly remove: (path: string) => Promise<void>;
}

/** A database and its `-wal`/`-journal` files, copied as one consistent unit. */
export interface FileGroup {
  /** Shown to the user when the group never settles. */
  readonly label: string;
  readonly from: readonly string[];
  readonly to: readonly string[];
}

export function errorCodeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

async function stampAll(
  fs: ProfileFileSystem,
  paths: readonly string[],
): Promise<(FileStamp | null)[]> {
  return Promise.all(paths.map((path) => fs.stamp(path)));
}

function areSame(
  a: readonly (FileStamp | null)[],
  b: readonly (FileStamp | null)[],
): boolean {
  return a.every(
    (stamp, index) =>
      stamp?.size === b[index]?.size && stamp?.mtimeMs === b[index]?.mtimeMs,
  );
}

async function copyOnce(ctx: CopyContext, group: FileGroup): Promise<boolean> {
  const before = await stampAll(ctx.fs, group.from);
  for (const [index, from] of group.from.entries()) {
    await ctx.fs.copyFile(from, group.to[index] ?? '');
  }
  return areSame(before, await stampAll(ctx.fs, group.from));
}

async function discard(ctx: CopyContext, group: FileGroup): Promise<void> {
  for (const path of group.to) await ctx.remove(path);
}

type Attempt = 'settled' | 'torn' | 'vanished' | 'busy';

async function attempt(ctx: CopyContext, group: FileGroup): Promise<Attempt> {
  try {
    return (await copyOnce(ctx, group)) ? 'settled' : 'torn';
  } catch (error) {
    const code = errorCodeOf(error);
    if (code === 'ENOENT') return 'vanished';
    if (code !== null && BUSY_CODES.has(code)) return 'busy';
    throw error;
  }
}

function conclude(group: FileGroup, outcome: Attempt): boolean {
  if (outcome === 'busy')
    throw new ProfileCopyError('source-in-use', group.label);
  return false;
}

async function run(
  ctx: CopyContext,
  group: FileGroup,
  retry: number,
): Promise<boolean> {
  const outcome = await attempt(ctx, group);
  if (outcome === 'settled') return true;
  if (outcome === 'vanished') {
    await discard(ctx, group);
    return true;
  }
  const delay = RETRY_DELAYS_MS[retry];
  if (delay === undefined) return conclude(group, outcome);
  await discard(ctx, group);
  await ctx.sleep(delay);
  return run(ctx, group, retry + 1);
}

/**
 * Copies the files of one group and retries a torn read (the source changed
 * while it was copied) or a busy file. Returns `false` when the copy never
 * settled; throws `source-in-use` when the file stayed locked. A file that
 * vanished is skipped: the browser deleted it between listing and copying.
 */
export function copyFileGroup(
  ctx: CopyContext,
  group: FileGroup,
): Promise<boolean> {
  return run(ctx, group, 0);
}
