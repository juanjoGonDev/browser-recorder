const FIRST_SUFFIX = 2;

/** The base slug, or the first `base-N` (N >= 2) not already taken. */
export function allocateSlug(base: string, taken: Iterable<string>): string {
  const takenSet = new Set(taken);
  if (!takenSet.has(base)) return base;
  let suffix = FIRST_SUFFIX;
  while (takenSet.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
