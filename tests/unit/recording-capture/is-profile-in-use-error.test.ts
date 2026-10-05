import { describe, expect, it } from 'vitest';
import {
  ProfileLockedAtLaunchError,
  isProfileInUseError,
} from '../../../src/recording-capture/domain/is-profile-in-use-error.ts';

describe('src/recording-capture/domain/is-profile-in-use-error.ts', () => {
  describe('isProfileInUseError', () => {
    it.each([
      'Failed to create a ProcessSingleton for your profile directory.',
      'Opening in existing browser session.',
      'browserType.launchPersistentContext: Target page, context or browser has been closed\n  [pid=1] <process did exit: exitCode=0> Opening in existing browser session.',
      'The profile appears to be in use by another Chromium process (123) on another computer',
      'Error: the profile is locked: SingletonLock exists',
    ])('recognises a lock message: %s', (message) => {
      expect(isProfileInUseError(new Error(message))).toBe(true);
    });

    it.each([
      "Executable doesn't exist at /nowhere/chrome",
      'Timeout 30000ms exceeded.',
      'net::ERR_CONNECTION_REFUSED',
    ])('does not mistake another failure for a lock: %s', (message) => {
      expect(isProfileInUseError(new Error(message))).toBe(false);
    });

    it('answers false for a value that is not an error', () => {
      expect(isProfileInUseError('ProcessSingleton')).toBe(false);
      expect(isProfileInUseError(null)).toBe(false);
    });
  });

  describe('ProfileLockedAtLaunchError', () => {
    it('tells the user what to do and keeps the engine error as its cause', () => {
      const cause = new Error('Opening in existing browser session.');
      const error = new ProfileLockedAtLaunchError(cause);
      expect(error.message).toBe(
        'The browser profile is already in use. Close the browser that is using it and try again.',
      );
      expect(error.name).toBe('ProfileLockedAtLaunchError');
      expect(error.cause).toBe(cause);
    });
  });
});
