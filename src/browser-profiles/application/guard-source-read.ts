import {
  classifyFileError,
  errorCodeOf,
} from '../domain/file-access-failure.ts';
import { ProfileCopyError } from '../domain/profile-errors.ts';

/**
 * Runs one read of the real profile. A permission block becomes
 * `source-unreadable` (named by a relative subject, never a path); every other
 * failure propagates unchanged.
 */
export async function guardSourceRead<T>(
  platform: string,
  subject: string,
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (classifyFileError(errorCodeOf(error), platform) === 'denied') {
      throw new ProfileCopyError('source-unreadable', subject);
    }
    throw error;
  }
}
