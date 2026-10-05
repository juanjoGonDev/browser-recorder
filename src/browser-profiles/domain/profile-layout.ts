import type { BrowserId } from '../../shared/domain/browser-choice.ts';

type Environment = Readonly<Record<string, string | undefined>>;

const APP_FOLDER = 'browser-recorder';

/** Chromium's only names for user profiles: `Default` and `Profile <n>`. */
export const SAFE_PROFILE_DIR = /^(?:Default|Profile \d{1,4})$/;

/** Where the tool keeps its own profiles, per browser. */
export interface ProfileLayout {
  /** `<root>/profiles/<id>/managed` */
  managedDir(id: BrowserId): string;
  /** `<root>/profiles/<id>/sessions`: copies and ephemeral profiles. */
  sessionsRoot(id: BrowserId): string;
}

function separatorOf(platform: string): string {
  return platform === 'win32' ? '\\' : '/';
}

/**
 * Joins path segments with the separator of `platform`. The domain cannot use
 * Node's `path`, and the layout must not depend on the host running the tests.
 */
export function joinPath(platform: string, ...segments: string[]): string {
  const separator = separatorOf(platform);
  return segments
    .map((segment, index) => {
      const withoutTrailing = segment.replace(/[\\/]+$/, '');
      return index === 0 ? withoutTrailing || segment : withoutTrailing;
    })
    .join(separator);
}

function pick(environment: Environment, name: string): string | null {
  const value = environment[name];
  return value === undefined || value === '' ? null : value;
}

/** The OS user data directory this tool owns; never a browser's own. */
export function appDataRootFor(
  platform: string,
  environment: Environment,
  home: string,
): string {
  if (platform === 'darwin') {
    return joinPath(
      platform,
      home,
      'Library',
      'Application Support',
      APP_FOLDER,
    );
  }
  if (platform === 'win32') {
    const local =
      pick(environment, 'LOCALAPPDATA') ??
      joinPath(platform, home, 'AppData', 'Local');
    return joinPath(platform, local, APP_FOLDER);
  }
  const data =
    pick(environment, 'XDG_DATA_HOME') ??
    joinPath(platform, home, '.local', 'share');
  return joinPath(platform, data, APP_FOLDER);
}

export function createProfileLayout(
  platform: string,
  appDataRoot: string,
): ProfileLayout {
  const under = (id: BrowserId, leaf: string): string =>
    joinPath(platform, appDataRoot, 'profiles', id, leaf);
  return {
    managedDir: (id) => under(id, 'managed'),
    sessionsRoot: (id) => under(id, 'sessions'),
  };
}
