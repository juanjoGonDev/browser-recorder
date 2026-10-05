import path from 'node:path';

export const FIXTURE_PROFILES_ROOT = path.resolve(
  import.meta.dirname,
  '..',
  'fixtures',
  'profiles',
);

/**
 * A made-up Brave user data directory. Opt-in real-browser tests copy from it
 * and assert the path stays under `tests/fixtures/`, so no test ever reads or
 * writes a real profile.
 */
export const BRAVE_LIKE_PROFILE = path.join(
  FIXTURE_PROFILES_ROOT,
  'brave-like',
);
