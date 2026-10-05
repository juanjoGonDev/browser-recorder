/** A recording the library lists; an unreadable one has no name. */
export interface RecordingChoice {
  readonly slug: string;
  readonly name: string | null;
}

export type RecordingLookup =
  | { readonly kind: 'found'; readonly slug: string }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'ambiguous'; readonly slugs: readonly string[] };

/**
 * The input is only ever compared with listed slugs and names, so it can
 * never become a path. An exact slug wins; otherwise the name is matched
 * ignoring case.
 */
export function findRecording(
  choices: readonly RecordingChoice[],
  query: string,
): RecordingLookup {
  const bySlug = choices.find((choice) => choice.slug === query);
  if (bySlug !== undefined) return { kind: 'found', slug: bySlug.slug };
  const wanted = query.toLowerCase();
  const slugs = choices
    .filter((choice) => choice.name?.toLowerCase() === wanted)
    .map((choice) => choice.slug);
  const [only] = slugs;
  if (only === undefined) return { kind: 'not-found' };
  return slugs.length === 1
    ? { kind: 'found', slug: only }
    : { kind: 'ambiguous', slugs };
}
