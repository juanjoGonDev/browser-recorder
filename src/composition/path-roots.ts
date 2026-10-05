import type { PathRoots } from '../browser-selection/domain/expand-path.ts';

type Environment = Readonly<Record<string, string | undefined>>;

function valueOf(environment: Environment, name: string): string | null {
  const value = environment[name];
  return value === undefined || value === '' ? null : value;
}

/** The well-known folders the browser catalogue expands its templates from. */
export function pathRootsFor(
  environment: Environment,
  homeDirectory: string,
): PathRoots {
  return {
    home: homeDirectory,
    localAppData: valueOf(environment, 'LOCALAPPDATA'),
    appData: valueOf(environment, 'APPDATA'),
    programFiles: valueOf(environment, 'PROGRAMFILES'),
    programFilesX86: valueOf(environment, 'PROGRAMFILES(X86)'),
    xdgConfigHome: valueOf(environment, 'XDG_CONFIG_HOME'),
  };
}
