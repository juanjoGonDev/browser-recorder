import {
  type LocalStateInfo,
  parseLocalState,
} from '../domain/parse-local-state.ts';
import { joinPath } from '../domain/profile-layout.ts';
import type { ProfileFileSystem } from './ports/profile-file-system.ts';

/** `null` when `Local State` is missing or unusable; nothing is written. */
export async function readLocalState(
  fs: ProfileFileSystem,
  platform: string,
  userDataDir: string,
): Promise<LocalStateInfo | null> {
  try {
    const text = await fs.readText(
      joinPath(platform, userDataDir, 'Local State'),
    );
    return parseLocalState(text);
  } catch {
    return null;
  }
}
