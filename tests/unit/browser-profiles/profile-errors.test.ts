import { describe, expect, it } from 'vitest';

import {
  ProfileCopyError,
  ProfileInUseError,
} from '../../../src/browser-profiles/domain/profile-errors.ts';

describe('ProfileInUseError', () => {
  it('names the browser and the directory', () => {
    const error = new ProfileInUseError('brave', '/data/brave/managed');
    expect(error.message).toBe(
      'The brave profile at /data/brave/managed is in use by another process. Close that browser and try again.',
    );
    expect(error.browserId).toBe('brave');
    expect(error.directory).toBe('/data/brave/managed');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ProfileInUseError');
  });
});

describe('ProfileCopyError', () => {
  it.each([
    ['source-in-use', /close the browser and try again/i],
    ['source-missing', /could not be found/i],
    ['unknown-profile', /not a profile of this browser/i],
  ] as const)('explains %s', (code, message) => {
    const error = new ProfileCopyError(code, 'Profile 9');
    expect(error.code).toBe(code);
    expect(error.message).toMatch(message);
    expect(error.message).toContain('Profile 9');
    expect(error.name).toBe('ProfileCopyError');
  });
});
