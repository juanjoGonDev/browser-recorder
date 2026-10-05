import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appDataRootFor } from '../browser-profiles/domain/profile-layout.ts';

export interface PathDeps {
  readText(file: string): string;
  exists(file: string): boolean;
  /** Locates the Patchright CLI script; throws when it cannot. */
  resolveCli(): string;
  /** `process.platform`, `process.env` and the home directory, injected. */
  readonly platform: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly homeDirectory: string;
}

export interface AppPaths {
  readonly packageRoot: string;
  /** `<packageRoot>/recordings`, git-ignored. */
  readonly recordingsRoot: string;
  /** The bundled capture script the Patchright adapter injects. */
  readonly inPageScriptPath: string;
  readonly patchrightCliPath: string;
  /** Where the tool keeps its managed profiles and profile copies. */
  readonly appDataRoot: string;
}

const PACKAGE_NAME = 'browser-recorder';
const PACKAGE_FILE = 'package.json';

function isOurPackage(
  directory: string,
  deps: Pick<PathDeps, 'readText' | 'exists'>,
): boolean {
  const manifest = path.join(directory, PACKAGE_FILE);
  if (!deps.exists(manifest)) return false;
  try {
    const parsed = JSON.parse(deps.readText(manifest)) as { name?: unknown };
    return parsed.name === PACKAGE_NAME;
  } catch {
    return false;
  }
}

/** The nearest directory upward whose package.json is this package's. */
export function findPackageRoot(
  startDirectory: string,
  deps: Pick<PathDeps, 'readText' | 'exists'>,
): string {
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
    patchrightCliPath: deps.resolveCli(),
    appDataRoot: appDataRootFor(
      deps.platform,
      deps.environment,
      deps.homeDirectory,
    ),
  };
}
