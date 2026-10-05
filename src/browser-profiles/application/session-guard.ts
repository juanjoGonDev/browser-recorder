import { isInsideDirectory } from '../domain/is-inside-directory.ts';
import { joinPath } from '../domain/profile-layout.ts';
import type { ProfileFileSystem } from './ports/profile-file-system.ts';

export interface SessionGuardDeps {
  readonly fs: ProfileFileSystem;
  readonly platform: string;
  readonly sessionsRoot: string;
}

export interface SessionGuard {
  newSessionDir(): string;
  /** Deletes a directory, but only one that lives inside the sessions root. */
  remove(path: string): Promise<void>;
}

/**
 * The only way the profile store deletes anything: a real profile or a managed
 * directory can never be removed by a bug or a hostile path.
 */
export function createSessionGuard(deps: SessionGuardDeps): SessionGuard {
  const { fs, platform, sessionsRoot } = deps;
  return {
    newSessionDir: () => joinPath(platform, sessionsRoot, fs.randomName()),
    remove: async (path) => {
      if (!isInsideDirectory(platform, sessionsRoot, path)) {
        throw new Error(
          `Refusing to remove ${path}: outside the sessions root`,
        );
      }
      await fs.remove(path);
    },
  };
}
