import { access, constants, stat } from 'node:fs/promises';

import type { FileProbe } from '../application/ports/file-probe.ts';

async function statOrNull(path: string) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Probes the real file system. On POSIX a browser must be an executable file;
 * Windows has no execute bit, so a file there only has to exist.
 */
export function createNodeFileProbe(platform: string): FileProbe {
  return {
    async isFile(path) {
      const info = await statOrNull(path);
      if (info === null || !info.isFile()) return false;
      return platform === 'win32' || (await isExecutable(path));
    },
    async isDirectory(path) {
      return (await statOrNull(path))?.isDirectory() ?? false;
    },
  };
}
