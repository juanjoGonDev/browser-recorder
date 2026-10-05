const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;
const LAST_C1 = 0x9f;
const CONTROL_PLACEHOLDER = '·';

/** https://no-color.org: any non-empty `NO_COLOR` turns color off. */
export function isColorEnabled(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  const noColor = env['NO_COLOR'];
  if (noColor !== undefined && noColor !== '') return false;
  return env['TERM'] !== 'dumb';
}

/** Recorded text is untrusted: no control character may reach the terminal. */
export function sanitize(text: string): string {
  return Array.from(text)
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      const isControl =
        code < FIRST_PRINTABLE || (code >= DELETE && code <= LAST_C1);
      return isControl ? CONTROL_PLACEHOLDER : character;
    })
    .join('');
}
