/**
 * Every browser the recorder can drive, in the order the picker shows them.
 * The bundled Chromium is last: it is always available, so it is the fallback.
 */
export const BROWSER_IDS = [
  'brave',
  'chrome',
  'edge',
  'chromium',
  'vivaldi',
  'opera',
  'bundled',
] as const;

export type BrowserId = (typeof BROWSER_IDS)[number];

/**
 * How the user profile of a recording is provided:
 * - `managed`: a tool-owned profile that keeps logins between runs.
 * - `copy-of-real`: a throwaway copy of a profile of the installed browser.
 * - `ephemeral`: an empty profile deleted afterwards.
 */
export type ProfileMode = 'managed' | 'copy-of-real' | 'ephemeral';

/** What a recording stores about its browser: an id and a mode, never paths. */
export interface BrowserChoice {
  readonly browserId: BrowserId;
  readonly profileMode: ProfileMode;
  /** `Default`, `Profile 2` and so on; non-null only for `copy-of-real`. */
  readonly sourceProfile: string | null;
}

/**
 * What runs when nothing else was chosen (and what a recording made before
 * browsers existed ran on): the bundled Chromium, nothing kept afterwards.
 */
export const BUNDLED_EPHEMERAL: BrowserChoice = {
  browserId: 'bundled',
  profileMode: 'ephemeral',
  sourceProfile: null,
};
