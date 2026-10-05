import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

const BROWSERS_PATH_VARIABLE = 'PLAYWRIGHT_BROWSERS_PATH';
const ISOLATED_ROOT_VARIABLE = 'BROWSER_RECORDER_ISOLATED_HOME';
const CACHE_FOLDER = 'ms-playwright';

type Environment = Readonly<Record<string, string | undefined>>;

/**
 * Where Patchright keeps its browsers, worked out the way the library does it
 * from the real home. Computed before the home is redirected so the downloaded
 * Chromium is still found afterwards.
 */
export function defaultBrowsersPath(
  platform: string,
  environment: Environment,
  home: string,
): string {
  const pinned = environment[BROWSERS_PATH_VARIABLE];
  if (pinned !== undefined && pinned !== '') return pinned;
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', CACHE_FOLDER);
  }
  if (platform === 'win32') {
    const local =
      environment['LOCALAPPDATA'] ?? path.join(home, 'AppData', 'Local');
    return path.join(local, CACHE_FOLDER);
  }
  const cache = environment['XDG_CACHE_HOME'] ?? path.join(home, '.cache');
  return path.join(cache, CACHE_FOLDER);
}

/** Every variable a browser or a library may use to find a user's files. */
export function isolatedEnvironment(root: string): Record<string, string> {
  const folder = (name: string): string => path.join(root, name);
  return {
    HOME: folder('home'),
    USERPROFILE: folder('home'),
    LOCALAPPDATA: folder('local-app-data'),
    APPDATA: folder('app-data'),
    XDG_CACHE_HOME: folder('xdg-cache'),
    XDG_CONFIG_HOME: folder('xdg-config'),
    XDG_DATA_HOME: folder('xdg-data'),
    XDG_STATE_HOME: folder('xdg-state'),
  };
}

/**
 * Vitest `globalSetup`: no test can read or write the developer's real home.
 * Pins the browser cache first (it is derived from the home), then points every
 * home variable at a temporary directory that is deleted afterwards. Workers
 * and the replay scripts they spawn inherit this environment.
 */
export default function isolateHome(): () => void {
  // Several projects run this setup in one process: isolate only once.
  if (process.env[ISOLATED_ROOT_VARIABLE] !== undefined) return () => undefined;
  process.env[BROWSERS_PATH_VARIABLE] = defaultBrowsersPath(
    process.platform,
    process.env,
    homedir(),
  );
  const root = mkdtempSync(path.join(tmpdir(), 'browser-recorder-home-'));
  const environment = isolatedEnvironment(root);
  for (const [name, value] of Object.entries(environment)) {
    mkdirSync(value, { recursive: true });
    process.env[name] = value;
  }
  process.env[ISOLATED_ROOT_VARIABLE] = root;
  return () => {
    rmSync(root, { recursive: true, force: true });
  };
}
