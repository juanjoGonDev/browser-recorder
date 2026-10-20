export type FileAccessFailure = 'missing' | 'denied' | 'busy' | 'other';

/** The errno name of a Node file error, or `null` when it carries none. */
export function errorCodeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

const FAILURE_BY_CODE: Readonly<Record<string, FileAccessFailure>> = {
  ENOENT: 'missing',
  EBUSY: 'busy',
  EACCES: 'denied',
};

/**
 * EPERM is a sharing lock on Windows but the operating system refusing access
 * elsewhere (the macOS privacy block), so the platform decides its meaning.
 */
export function classifyFileError(
  code: string | null,
  platform: string,
): FileAccessFailure {
  if (code === 'EPERM') return platform === 'win32' ? 'busy' : 'denied';
  return (code === null ? undefined : FAILURE_BY_CODE[code]) ?? 'other';
}
