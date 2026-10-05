import { randomUUID } from 'node:crypto';
import {
  chmod,
  constants,
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rm,
  stat,
} from 'node:fs/promises';

import { BROWSER_DIRECTORY_REMOVAL } from '../../shared/domain/browser-directory-removal.ts';
import type {
  DirEntry,
  FileStamp,
  ProfileFileSystem,
} from '../application/ports/profile-file-system.ts';

const PRIVATE_MODE = 0o700;

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function kindOf(entry: {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}): DirEntry['kind'] {
  if (entry.isSymbolicLink()) return 'symlink';
  if (entry.isDirectory()) return 'directory';
  return entry.isFile() ? 'file' : 'other';
}

export const nodeProfileFileSystem: ProfileFileSystem = {
  async makePrivateDir(path) {
    await mkdir(path, { recursive: true, mode: PRIVATE_MODE });
    // `mode` is masked by the umask and ignored for a directory that exists.
    if (process.platform !== 'win32') await chmod(path, PRIVATE_MODE);
  },
  readText: (path) => readFile(path, 'utf8'),
  async list(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .map((entry) => ({ name: entry.name, kind: kindOf(entry) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async stamp(path): Promise<FileStamp | null> {
    try {
      const info = await stat(path);
      return info.isFile() ? { size: info.size, mtimeMs: info.mtimeMs } : null;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  },
  async readLink(path) {
    try {
      return await readlink(path);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'EINVAL') return null;
      throw error;
    }
  },
  async exists(path) {
    try {
      await lstat(path);
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  },
  // The source is only read and the destination is never overwritten.
  copyFile: (from, to) => copyFile(from, to, constants.COPYFILE_EXCL),
  remove: (path) => rm(path, BROWSER_DIRECTORY_REMOVAL),
  randomName: () => randomUUID(),
};
