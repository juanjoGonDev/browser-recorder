import { isAbsolute, relative, resolve } from 'node:path';

/** Joins segments under the root and throws if the result leaves it. */
export function resolveInsideRoot(
  root: string,
  ...segments: readonly string[]
): string {
  const resolved = resolve(root, ...segments);
  const fromRoot = relative(resolve(root), resolved);
  const isOutside =
    fromRoot === '..' || fromRoot.startsWith('..') || isAbsolute(fromRoot);
  if (isOutside) {
    throw new Error(`Path ${resolved} is outside the recordings root.`);
  }
  return resolved;
}
