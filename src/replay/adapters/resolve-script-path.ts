import type path from 'node:path';

const SCRIPT_FILE = 'script.mjs';

type PathApi = Pick<typeof path, 'join' | 'sep'>;

function isSingleSegment(slug: string): boolean {
  const hasSeparator = /[\\/:]/.test(slug);
  return slug !== '' && slug !== '.' && slug !== '..' && !hasSeparator;
}

/** Builds `<recordings>/<slug>/script.mjs` with the platform's separators. */
export function resolveScriptPath(
  pathApi: PathApi,
  recordingsRoot: string,
  slug: string,
): string {
  if (!isSingleSegment(slug)) {
    throw new Error(`Invalid recording slug: ${JSON.stringify(slug)}.`);
  }
  return pathApi.join(recordingsRoot, slug, SCRIPT_FILE);
}
