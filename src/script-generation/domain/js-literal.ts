const LINE_SEPARATOR = new RegExp(String.raw`\u2028`, 'gu');
const PARAGRAPH_SEPARATOR = new RegExp(String.raw`\u2029`, 'gu');

/**
 * The only way a recorded string reaches generated code. `JSON.stringify`
 * escapes quotes, backslashes and control characters, but leaves U+2028 and
 * U+2029 raw; both end a line in older engines, so they are escaped too. Lone
 * surrogates come out escaped as well, so the literal is always well formed.
 */
export function jsString(value: string): string {
  return JSON.stringify(value)
    .replace(LINE_SEPARATOR, String.raw`\u2028`)
    .replace(PARAGRAPH_SEPARATOR, String.raw`\u2029`);
}

export function jsStringArray(values: readonly string[]): string {
  return `[${values.map(jsString).join(', ')}]`;
}

/** Offsets and coordinates; `NaN` would print as an identifier, not data. */
export function jsNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Expected a finite number, received ${value}`);
  }
  return JSON.stringify(value);
}
