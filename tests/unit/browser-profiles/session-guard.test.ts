import { describe, expect, it } from 'vitest';

import { createSessionGuard } from '../../../src/browser-profiles/application/session-guard.ts';
import { MemoryProfileFileSystem } from '../../support/memory-profile-file-system.ts';

const SESSIONS = '/data/brave/sessions';

function guard(fs = new MemoryProfileFileSystem()): {
  fs: MemoryProfileFileSystem;
  sessions: ReturnType<typeof createSessionGuard>;
} {
  return {
    fs,
    sessions: createSessionGuard({
      fs,
      platform: 'linux',
      sessionsRoot: SESSIONS,
    }),
  };
}

describe('createSessionGuard', () => {
  it('names new session directories under the sessions root', () => {
    const { sessions } = guard();
    expect(sessions.newSessionDir()).toBe(`${SESSIONS}/random1`);
    expect(sessions.newSessionDir()).toBe(`${SESSIONS}/random2`);
  });

  it('removes a directory inside the sessions root', async () => {
    const { fs, sessions } = guard();
    fs.addFile(`${SESSIONS}/random1/a`, 'x');
    await sessions.remove(`${SESSIONS}/random1`);
    expect(fs.pathsUnder(SESSIONS)).toEqual([]);
  });

  it.each([
    '/real/Brave',
    '/data/brave/sessions',
    '/data/brave/sessions/../managed',
    '/data/brave/sessions/a/../../managed',
    '/data/brave/sessions-other/x',
    '/data/brave/sessions/./x',
    '',
  ])('refuses to remove %j', async (path) => {
    const { fs, sessions } = guard();
    await expect(sessions.remove(path)).rejects.toThrow(/outside the sessions/);
    expect(fs.removed).toEqual([]);
  });

  it('works with Windows separators', async () => {
    const fs = new MemoryProfileFileSystem();
    const win = createSessionGuard({
      fs,
      platform: 'win32',
      sessionsRoot: 'C:\\data\\sessions',
    });
    expect(win.newSessionDir()).toBe('C:\\data\\sessions\\random1');
    await expect(win.remove('C:\\data\\managed')).rejects.toThrow(/outside/);
    await expect(win.remove('C:\\data\\sessions\\..\\x')).rejects.toThrow(
      /outside/,
    );
    await win.remove('C:\\data\\sessions\\random1');
    expect(fs.removed).toEqual(['C:\\data\\sessions\\random1']);
  });
});
