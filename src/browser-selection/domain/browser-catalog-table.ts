import type { BrowserId } from '../../shared/domain/browser-choice.ts';
import type { Platform } from './expand-path.ts';

/** Path templates for one browser; `{home}` and the like are filled in later. */
export interface BrowserCandidate {
  readonly browserId: Exclude<BrowserId, 'bundled'>;
  readonly label: string;
  readonly executables: readonly string[];
  /** `null` when the browser's data directory is not a profile container. */
  readonly userDataDir: string | null;
}

export type BrowserTables = Readonly<
  Record<Platform, readonly BrowserCandidate[]>
>;
