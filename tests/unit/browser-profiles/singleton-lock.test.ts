import { describe, expect, it } from 'vitest';

import { parseSingletonLock } from '../../../src/browser-profiles/domain/singleton-lock.ts';

describe('parseSingletonLock', () => {
  it('splits host and pid', () => {
    expect(parseSingletonLock('laptop-4242')).toEqual({
      host: 'laptop',
      pid: 4242,
    });
  });

  it('keeps dashes inside the host name', () => {
    expect(parseSingletonLock('my-host-name-17')).toEqual({
      host: 'my-host-name',
      pid: 17,
    });
  });

  it.each([
    '',
    'nohost',
    'host-',
    'host-abc',
    'host-0',
    'host--5',
    '-12',
    'h-1x',
  ])('rejects %j', (target) => {
    expect(parseSingletonLock(target)).toBeNull();
  });
});
