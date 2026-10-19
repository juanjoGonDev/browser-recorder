import { describe, expect, it } from 'vitest';

import {
  classifyFileError,
  errorCodeOf,
} from '../../../src/browser-profiles/domain/file-access-failure.ts';

describe('classifyFileError', () => {
  it.each([
    ['ENOENT', 'linux', 'missing'],
    ['ENOENT', 'win32', 'missing'],
    ['EBUSY', 'darwin', 'busy'],
    ['EBUSY', 'win32', 'busy'],
    ['EACCES', 'darwin', 'denied'],
    ['EACCES', 'win32', 'denied'],
    ['EPERM', 'win32', 'busy'],
    ['EPERM', 'darwin', 'denied'],
    ['EPERM', 'linux', 'denied'],
    ['EIO', 'darwin', 'other'],
    [null, 'linux', 'other'],
  ] as const)('maps %s on %s to %s', (code, platform, expected) => {
    expect(classifyFileError(code, platform)).toBe(expected);
  });
});

describe('errorCodeOf', () => {
  it('reads a string code', () => {
    expect(errorCodeOf(Object.assign(new Error('x'), { code: 'EPERM' }))).toBe(
      'EPERM',
    );
  });

  it.each([new Error('plain'), null, undefined, { code: 5 }])(
    'returns null for %j',
    (error) => {
      expect(errorCodeOf(error)).toBeNull();
    },
  );
});
