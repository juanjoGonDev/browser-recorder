import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';

/**
 * The one folder tests use as scratch inside the repository (generated scripts
 * must resolve `patchright` from `node_modules`). It is gitignored and swept by
 * the `scratch-root-setup` global setup. Tests never touch `recordings/`, which
 * holds the user's real recordings.
 */
export const SCRATCH_ROOT = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '.test-scratch',
);

/** Creates a unique scratch folder under {@link SCRATCH_ROOT}. */
export function createScratchDir(prefix: string): string {
  mkdirSync(SCRATCH_ROOT, { recursive: true });
  return mkdtempSync(path.join(SCRATCH_ROOT, prefix));
}
