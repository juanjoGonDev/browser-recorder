import { describe, expect, it } from 'vitest';

import {
  shouldCopy,
  SQLITE_COMPANIONS,
} from '../../../src/browser-profiles/domain/copy-filter.ts';

describe('shouldCopy', () => {
  it.each([
    'SingletonLock',
    'SingletonSocket',
    'SingletonCookie',
    'lockfile',
    'LOCK',
    'Cache',
    'Code Cache',
    'GPUCache',
    'Crashpad',
    'Safe Browsing',
    'Sessions',
    'Current Session',
    'blob_storage',
  ])('skips %s', (name) => {
    expect(shouldCopy([name])).toBe(false);
  });

  it('skips anything below a denied directory', () => {
    expect(shouldCopy(['Default', 'Cache', 'x'])).toBe(false);
    expect(shouldCopy(['Default', 'Service Worker', 'CacheStorage', 'a'])).toBe(
      false,
    );
  });

  it.each(['Cookies-shm', 'History.tmp', 'Foo.pma'])(
    'skips the transient file %s',
    (name) => {
      expect(shouldCopy(['Default', name])).toBe(false);
    },
  );

  it.each([
    ['Local State'],
    ['Default', 'Preferences'],
    ['Default', 'Cookies'],
    ['Default', 'Cookies-wal'],
    ['Default', 'Login Data-journal'],
    ['Default', 'Local Storage', 'leveldb', '000003.log'],
  ])('keeps %j', (...segments) => {
    expect(shouldCopy(segments)).toBe(true);
  });

  it('is case sensitive like the browser file names', () => {
    expect(shouldCopy(['Default', 'cache'])).toBe(true);
  });
});

describe('SQLITE_COMPANIONS', () => {
  it('names the siblings that travel with a database', () => {
    expect(SQLITE_COMPANIONS).toEqual(['-wal', '-journal']);
  });
});
