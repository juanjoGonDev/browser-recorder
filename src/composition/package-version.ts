import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPackageRoot } from './resolve-paths.ts';
import type { PathDeps } from './resolve-paths.ts';

const PACKAGE_FILE = 'package.json';

/** The `version` of this package's manifest, found from one of its modules. */
export function readPackageVersion(
  moduleUrl: string,
  deps: Pick<PathDeps, 'readText' | 'exists'>,
): string {
  const root = findPackageRoot(path.dirname(fileURLToPath(moduleUrl)), deps);
  const manifest = JSON.parse(deps.readText(path.join(root, PACKAGE_FILE))) as {
    version?: unknown;
  };
  if (typeof manifest.version !== 'string') {
    throw new Error('The package manifest has no version.');
  }
  return manifest.version;
}
