import type {
  BrowserId,
  ProfileMode,
} from '../../shared/domain/browser-choice.ts';
import type { LocalStateInfo } from '../domain/parse-local-state.ts';

export type ProfileWarning =
  | { readonly code: 'source-running' }
  | { readonly code: 'app-bound-encryption' }
  | { readonly code: 'unstable-copy'; readonly files: readonly string[] };

export interface PrepareProfileRequest {
  readonly browserId: BrowserId;
  readonly profileMode: ProfileMode;
  readonly sourceProfile: string | null;
  /** The browser's own data directory; only read for `copy-of-real`. */
  readonly realUserDataDir: string | null;
}

export interface PreparedProfile {
  readonly userDataDir: string;
  readonly browserArgs: readonly string[];
  readonly shouldUseRealKeychain: boolean;
  readonly warnings: readonly ProfileWarning[];
  /** Deletes what the profile owns (a copy, an ephemeral profile). */
  release(): Promise<void>;
}

export interface ProfileStore {
  /** `null` when `Local State` is missing or unreadable. */
  listRealProfiles(realUserDataDir: string): Promise<LocalStateInfo | null>;
  prepare(request: PrepareProfileRequest): Promise<PreparedProfile>;
  sweepStaleSessions(): Promise<void>;
}
