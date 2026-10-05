export type Platform = 'darwin' | 'win32' | 'linux';

/** The well-known folders a path template may start from; `null` when absent. */
export interface PathRoots {
  readonly home: string;
  readonly localAppData: string | null;
  readonly appData: string | null;
  readonly programFiles: string | null;
  readonly programFilesX86: string | null;
  readonly xdgConfigHome: string | null;
}

const PLACEHOLDER = /\{([A-Za-z0-9]+)\}/g;

function rootValue(name: string, roots: PathRoots): string | null {
  switch (name) {
    case 'home':
      return roots.home;
    case 'localAppData':
      return roots.localAppData;
    case 'appData':
      return roots.appData;
    case 'programFiles':
      return roots.programFiles;
    case 'programFilesX86':
      return roots.programFilesX86;
    case 'xdgConfigHome':
      return roots.xdgConfigHome ?? `${roots.home}/.config`;
    default:
      return null;
  }
}

/**
 * Fills a path template in, or answers `null` when it names a root that is not
 * available (or does not exist), so the candidate is skipped instead of probed.
 */
export function expandPath(template: string, roots: PathRoots): string | null {
  const isMissing = [...template.matchAll(PLACEHOLDER)].some(
    (match) => rootValue(match[1] ?? '', roots) === null,
  );
  if (isMissing) return null;
  return template.replace(
    PLACEHOLDER,
    (_match, name: string) => rootValue(name, roots) ?? '',
  );
}
