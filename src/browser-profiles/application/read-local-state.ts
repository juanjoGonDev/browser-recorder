import {
  classifyFileError,
  errorCodeOf,
} from '../domain/file-access-failure.ts';
import {
  type LocalStateInfo,
  parseLocalState,
} from '../domain/parse-local-state.ts';
import { joinPath } from '../domain/profile-layout.ts';
import type { ProfileFileSystem } from './ports/profile-file-system.ts';

export type LocalStateRead =
  | { readonly kind: 'ok'; readonly info: LocalStateInfo }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unreadable' };

/**
 * Missing and unparsable files are `missing`; a permission block (or a lock)
 * is `unreadable`. Any other failure propagates unchanged. Nothing is written.
 */
export async function readLocalState(
  fs: ProfileFileSystem,
  platform: string,
  userDataDir: string,
): Promise<LocalStateRead> {
  let text: string;
  try {
    text = await fs.readText(joinPath(platform, userDataDir, 'Local State'));
  } catch (error) {
    const failure = classifyFileError(errorCodeOf(error), platform);
    if (failure === 'missing') return { kind: 'missing' };
    if (failure === 'other') throw error;
    return { kind: 'unreadable' };
  }
  try {
    return { kind: 'ok', info: parseLocalState(text) };
  } catch {
    return { kind: 'missing' };
  }
}
