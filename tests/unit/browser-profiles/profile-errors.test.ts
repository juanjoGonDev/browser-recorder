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

describe('ProfileCopyError source-unreadable', () => {
  it('reports permission denied, distinct from missing, without a path', () => {
    const unreadable = new ProfileCopyError('source-unreadable', 'Local State');
    const missing = new ProfileCopyError('source-missing', 'Local State');
    expect(unreadable.code).toBe('source-unreadable');
    expect(unreadable.message).toBe(
      '"Local State" could not be read: permission denied.',
    );
    expect(unreadable.message).not.toBe(missing.message);
    expect(unreadable.message).not.toMatch(/[\\/]/);
  });

  it('names the subject it was given', () => {
    const error = new ProfileCopyError('source-unreadable', 'Default');
    expect(error.message).toBe(
      '"Default" could not be read: permission denied.',
    );
  });
});
