export const MINIMUM_NODE = '22.13.0';
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)/;

function parse(version: string): readonly number[] | null {
  const match = VERSION.exec(version);
  return match === null ? null : match.slice(1).map(Number);
}

function isAtLeastMinimum(parts: readonly number[]): boolean {
  const required = parse(MINIMUM_NODE) ?? [];
  for (const [position, minimum] of required.entries()) {
    const actual = parts[position] ?? 0;
    if (actual !== minimum) return actual > minimum;
  }
  return true;
}

/** Throws a message naming the minimum version when Node is too old. */
export function assertSupportedNode(version: string): void {
  const parts = parse(version);
  if (parts === null || !isAtLeastMinimum(parts)) {
    throw new Error(
      `browser-recorder needs Node.js ${MINIMUM_NODE} or newer; found ${version.replace(/^v/, '')}.`,
    );
  }
}
