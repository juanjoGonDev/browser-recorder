import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveScriptPath } from '../../../src/replay/adapters/resolve-script-path.ts';

describe('resolveScriptPath', () => {
  it('builds a backslash-only path on Windows, spaces included', () => {
    const result = resolveScriptPath(
      path.win32,
      'C:\\Users\\me\\app\\recordings',
      'my-login flow',
    );

    expect(result).toBe(
      'C:\\Users\\me\\app\\recordings\\my-login flow\\script.mjs',
    );
    expect(result).not.toContain('/');
  });

  it('builds a slash-only path on POSIX', () => {
    expect(resolveScriptPath(path.posix, '/home/me/recordings', 'a')).toBe(
      '/home/me/recordings/a/script.mjs',
    );
  });

  it.each(['../x', 'a/b', 'a\\b', 'C:\\x', '..', '.', ''])(
    'rejects the slug %j',
    (slug) => {
      expect(() =>
        resolveScriptPath(path.win32, 'C:\\recordings', slug),
      ).toThrow(/slug/i);
      expect(() => resolveScriptPath(path.posix, '/recordings', slug)).toThrow(
        /slug/i,
      );
    },
  );
});
