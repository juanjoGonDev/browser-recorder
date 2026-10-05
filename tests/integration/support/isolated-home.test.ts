import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'patchright';
import { describe, expect, it } from 'vitest';

const HOME_VARIABLES = [
  'HOME',
  'USERPROFILE',
  'LOCALAPPDATA',
  'APPDATA',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_STATE_HOME',
] as const;

describe('the test run environment (isolated-home globalSetup)', () => {
  it('points every home variable into a temporary directory', () => {
    const temporary = path.resolve(tmpdir());
    for (const name of HOME_VARIABLES) {
      const value = process.env[name] ?? '';
      expect(path.resolve(value).startsWith(temporary + path.sep)).toBe(true);
    }
  });

  it('makes the operating system report the isolated home, not the real one', () => {
    expect(path.resolve(homedir()).startsWith(path.resolve(tmpdir()))).toBe(
      true,
    );
    expect(homedir()).toBe(process.env['HOME']);
  });

  it('still finds the browser Patchright installed, through the pinned cache', () => {
    const pinned = process.env['PLAYWRIGHT_BROWSERS_PATH'] ?? '';
    expect(pinned).not.toBe('');
    expect(chromium.executablePath().startsWith(pinned)).toBe(true);
    expect(existsSync(chromium.executablePath())).toBe(true);
  });

  it('keeps the pinned cache outside the isolated home', () => {
    const pinned = process.env['PLAYWRIGHT_BROWSERS_PATH'] ?? '';
    expect(pinned).not.toBe('');
    expect(pinned.startsWith(process.env['HOME'] ?? '/')).toBe(false);
  });
});
