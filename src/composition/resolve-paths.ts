import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PathDeps {
  readText(file: string): string;
  exists(file: string): boolean;
  /** Locates the Patchright CLI script; throws when it cannot. */
  resolveCli(): string;
}

export interface AppPaths {
  readonly packageRoot: string;
  /** `<packageRoot>/recordings`, git-ignored. */
  readonly recordingsRoot: string;
  /** The bundled capture script the Playwright adapter injects. */
  readonly inPageScriptPath: string;
  readonly playwrightCliPath: string;
}

const PACKAGE_NAME = 'browser-recorder';
const PACKAGE_FILE = 'package.json';

function isOurPackage(directory: string, deps: PathDeps): boolean {
  const manifest = path.join(directory, PACKAGE_FILE);
  if (!deps.exists(manifest)) return false;
  try {
    const parsed = JSON.parse(deps.readText(manifest)) as { name?: unknown };
    return parsed.name === PACKAGE_NAME;
  } catch {
    return false;
  }
}

function findPackageRoot(startDirectory: string, deps: PathDeps): string {
  let directory = startDirectory;
  for (;;) {
    if (isOurPackage(directory, deps)) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error(
        `Could not find the ${PACKAGE_NAME} package root above ${startDirectory}.`,
      );
    }
    directory = parent;
  }
}

/** Where the app lives, found from the URL of one of its own modules. */
export function resolveAppPaths(moduleUrl: string, deps: PathDeps): AppPaths {
  const packageRoot = findPackageRoot(
    path.dirname(fileURLToPath(moduleUrl)),
    deps,
  );
  return {
    packageRoot,
    recordingsRoot: path.join(packageRoot, 'recordings'),
    inPageScriptPath: path.join(
      packageRoot,
      'dist',
      'in-page',
      'capture-script.js',
    ),
    playwrightCliPath: deps.resolveCli(),
  };
}
