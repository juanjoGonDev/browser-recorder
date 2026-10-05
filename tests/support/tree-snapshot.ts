import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export interface TreeEntry {
  /** Relative to the snapshot root, always with `/` separators. */
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
  readonly mtimeMs: number;
}

async function walk(root: string, relative: string): Promise<TreeEntry[]> {
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true,
  });
  const found: TreeEntry[] = [];
  for (const entry of entries) {
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walk(root, next)));
    } else if (entry.isFile()) {
      const file = path.join(root, next);
      const [content, info] = await Promise.all([readFile(file), stat(file)]);
      found.push({
        path: next,
        sha256: createHash('sha256').update(content).digest('hex'),
        size: info.size,
        mtimeMs: info.mtimeMs,
      });
    }
  }
  return found;
}

/**
 * Every file under `root` with its content hash and modification time, sorted
 * by path. Two snapshots are equal only if nothing was written, touched, added
 * or removed in between: the proof that a source profile stays read-only.
 */
export async function snapshotTree(root: string): Promise<TreeEntry[]> {
  const entries = await walk(root, '');
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
