import type { ProfileWarning } from '../browser-profiles/application/profile-store.ts';
import {
  ProfileCopyError,
  ProfileInUseError,
} from '../browser-profiles/domain/profile-errors.ts';
import type { BrowserId } from '../shared/domain/browser-choice.ts';
import { browserLabelOf } from './browser-labels.ts';

/** Wording of the cautions the profile store raises, for the TUI to show. */
export function describeProfileWarning(
  warning: ProfileWarning,
  browserId: BrowserId,
): string {
  const label = browserLabelOf(browserId);
  switch (warning.code) {
    case 'source-running':
      return `${label} is running: the copy may miss its latest changes.`;
    case 'app-bound-encryption':
      return `${label} protects its cookies with app-bound encryption: the copy will probably not be logged in.`;
    case 'unstable-copy':
      return `${warning.files.join(', ')} kept changing while copying: the copy may be incomplete.`;
  }
}

/**
 * Failures of the profile store become messages that name the browser but
 * never a path. Anything else is not ours to reword.
 */
export function explainProfileFailure(
  error: unknown,
  browserId: BrowserId,
): Error {
  const label = browserLabelOf(browserId);
  if (error instanceof ProfileInUseError) {
    return new Error(
      `The ${label} profile is in use by another process. Close the browser or recording using it and try again.`,
    );
  }
  if (error instanceof ProfileCopyError) {
    switch (error.code) {
      case 'source-in-use':
        return new Error(
          `${label} is running and holds files of the profile to copy. Close it and try again.`,
        );
      case 'source-missing':
        return new Error(
          `The ${label} profile to copy could not be found. Is ${label} still installed?`,
        );
      case 'unknown-profile':
        return new Error(
          `That profile is not a profile of ${label}. Pick another profile.`,
        );
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}
