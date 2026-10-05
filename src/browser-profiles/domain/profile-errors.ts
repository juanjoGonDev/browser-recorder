import type { BrowserId } from '../../shared/domain/browser-choice.ts';

/** Another live process holds the profile directory: nothing was launched. */
export class ProfileInUseError extends Error {
  readonly browserId: BrowserId;
  readonly directory: string;

  constructor(browserId: BrowserId, directory: string) {
    super(
      `The ${browserId} profile at ${directory} is in use by another process. Close that browser and try again.`,
    );
    this.name = 'ProfileInUseError';
    this.browserId = browserId;
    this.directory = directory;
  }
}

export type ProfileCopyErrorCode =
  'source-in-use' | 'source-missing' | 'unknown-profile';

const COPY_ERROR_TEXT: Readonly<Record<ProfileCopyErrorCode, string>> = {
  'source-in-use':
    'is locked by the running browser. Close the browser and try again',
  'source-missing': 'could not be found',
  'unknown-profile': 'is not a profile of this browser',
};

/** The copy of a real profile could not be made; the partial copy is gone. */
export class ProfileCopyError extends Error {
  readonly code: ProfileCopyErrorCode;

  constructor(code: ProfileCopyErrorCode, subject: string) {
    super(`"${subject}" ${COPY_ERROR_TEXT[code]}.`);
    this.name = 'ProfileCopyError';
    this.code = code;
  }
}
