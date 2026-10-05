/** SQLite siblings that must travel with their database to keep it valid. */
export const SQLITE_COMPANIONS = ['-wal', '-journal'] as const;

const LOCK_NAMES = [
  'SingletonLock',
  'SingletonSocket',
  'SingletonCookie',
  'lockfile',
  'LOCK',
];

const REBUILDABLE_NAMES = [
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'GrShaderCache',
  'GraphiteDawnCache',
  'ShaderCache',
  'CacheStorage',
  'ScriptCache',
  'Crashpad',
  'Crash Reports',
  'BrowserMetrics',
  'component_crx_cache',
  'optimization_guide_model_store',
  'Safe Browsing',
  'blob_storage',
];

/** Restored tabs would reopen pages in the recorded session. */
const SESSION_NAMES = [
  'Sessions',
  'Current Session',
  'Current Tabs',
  'Last Session',
  'Last Tabs',
];

const DENIED_NAMES: ReadonlySet<string> = new Set([
  ...LOCK_NAMES,
  ...REBUILDABLE_NAMES,
  ...SESSION_NAMES,
]);

/** `-shm` is rebuilt by SQLite from the `-wal`; the others are scratch files. */
const DENIED_SUFFIXES = ['-shm', '.tmp', '.pma'];

/**
 * Whether an entry of a profile may be copied. `segments` is the path below
 * the user data directory; a denied name excludes everything beneath it.
 */
export function shouldCopy(segments: readonly string[]): boolean {
  if (segments.some((segment) => DENIED_NAMES.has(segment))) return false;
  const leaf = segments.at(-1) ?? '';
  return !DENIED_SUFFIXES.some((suffix) => leaf.endsWith(suffix));
}
