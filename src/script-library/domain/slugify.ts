const MAX_SLUG_LENGTH = 60;
const FALLBACK_SLUG = 'recording';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Windows refuses these device names as a file or folder name on any extension.
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Lowercase ASCII, hyphen separated, safe as one path segment on every OS. */
export function slugify(name: string): string {
  const folded = name
    .normalize('NFKD')
    .replaceAll(/\p{Mn}/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replaceAll(/-+$/g, '');
  if (folded === '') return FALLBACK_SLUG;
  return WINDOWS_RESERVED.test(folded) ? `${FALLBACK_SLUG}-${folded}` : folded;
}
