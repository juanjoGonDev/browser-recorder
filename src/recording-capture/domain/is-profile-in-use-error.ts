/**
 * What Chromium prints when its profile directory belongs to a running
 * instance: it hands the launch over to that instance and exits, so the
 * engine only reports a closed browser plus the browser's own reason.
 */
const LOCK_MESSAGES: readonly RegExp[] = [
  /ProcessSingleton/i,
  /Opening in existing browser session/i,
  /profile appears to be in use/i,
  /SingletonLock/i,
];

export function isProfileInUseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return LOCK_MESSAGES.some((pattern) => pattern.test(error.message));
}

/** The launch failed because another browser holds the profile (Locked at start). */
export class ProfileLockedAtLaunchError extends Error {
  constructor(cause: unknown) {
    super(
      'The browser profile is already in use. Close the browser that is using it and try again.',
      { cause },
    );
    this.name = 'ProfileLockedAtLaunchError';
  }
}
