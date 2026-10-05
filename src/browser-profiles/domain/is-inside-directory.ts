function separatorOf(platform: string): string {
  return platform === 'win32' ? '\\' : '/';
}

/**
 * Whether `candidate` is strictly below `root`, judged on the text alone: no
 * `.` or `..` segment may appear, so a path cannot climb out of the root.
 */
export function isInsideDirectory(
  platform: string,
  root: string,
  candidate: string,
): boolean {
  const separator = separatorOf(platform);
  const prefix = root.endsWith(separator) ? root : `${root}${separator}`;
  if (!candidate.startsWith(prefix) || candidate.length === prefix.length) {
    return false;
  }
  const rest = candidate.slice(prefix.length).split(separator);
  return rest.every((part) => part !== '' && part !== '.' && part !== '..');
}
