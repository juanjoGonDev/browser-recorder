const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);
const INVALID_MESSAGE = 'Start URL must be empty or an http/https URL.';

/** An error message, or `null` when the URL is empty or http/https. */
export function validateStartUrl(startUrl: string): string | null {
  const trimmed = startUrl.trim();
  if (trimmed === '') return null;
  if (!URL.canParse(trimmed)) return INVALID_MESSAGE;
  return ALLOWED_PROTOCOLS.has(new URL(trimmed).protocol)
    ? null
    : INVALID_MESSAGE;
}
