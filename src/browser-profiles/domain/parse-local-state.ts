import { SAFE_PROFILE_DIR } from './profile-layout.ts';

export interface RealProfile {
  /** The folder name, for example `Default` or `Profile 2`. */
  readonly directory: string;
  readonly displayName: string;
}

export interface LocalStateInfo {
  readonly profiles: readonly RealProfile[];
  readonly hasAppBoundEncryption: boolean;
}

type JsonObject = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function childObject(parent: JsonObject, key: string): JsonObject {
  const child = parent[key];
  return isObject(child) ? child : {};
}

function parseJson(text: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Local State is not valid JSON');
  }
  if (!isObject(parsed)) throw new Error('Local State is not a JSON object');
  return parsed;
}

/** Declared order first, then the rest with `Default` ahead of the others. */
function orderDirectories(
  names: readonly string[],
  declared: unknown,
): string[] {
  const known = new Set(names);
  const ordered = new Set<string>();
  for (const name of Array.isArray(declared) ? declared : []) {
    if (typeof name === 'string' && known.has(name)) ordered.add(name);
  }
  const rest = names.filter((name) => !ordered.has(name));
  rest.sort((a, b) => Number(b === 'Default') - Number(a === 'Default'));
  return [...ordered, ...rest];
}

function displayNameOf(entry: unknown, directory: string): string {
  const name = isObject(entry) ? entry['name'] : undefined;
  return typeof name === 'string' && name !== '' ? name : directory;
}

/**
 * The profiles a Chromium browser lists in `Local State`. Directory names are
 * data from a file the user (or malware) may edit, so only Chromium's own
 * naming scheme survives: a hostile name never reaches a path.
 */
export function parseLocalState(text: string): LocalStateInfo {
  const root = parseJson(text);
  const profile = childObject(root, 'profile');
  const cache = childObject(profile, 'info_cache');
  const safe = Object.keys(cache).filter((name) => SAFE_PROFILE_DIR.test(name));
  const profiles = orderDirectories(safe, profile['profiles_order']).map(
    (directory) => ({
      directory,
      displayName: displayNameOf(cache[directory], directory),
    }),
  );
  const osCrypt = childObject(root, 'os_crypt');
  return {
    profiles,
    hasAppBoundEncryption: 'app_bound_encrypted_key' in osCrypt,
  };
}
