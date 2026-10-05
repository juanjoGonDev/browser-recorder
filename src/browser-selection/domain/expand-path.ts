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
