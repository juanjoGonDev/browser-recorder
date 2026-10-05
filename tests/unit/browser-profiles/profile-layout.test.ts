import { describe, expect, it } from 'vitest';

import {
  appDataRootFor,
  createProfileLayout,
  joinPath,
  SAFE_PROFILE_DIR,
} from '../../../src/browser-profiles/domain/profile-layout.ts';

describe('appDataRootFor', () => {
  it('uses Application Support on macOS', () => {
    expect(appDataRootFor('darwin', {}, '/Users/ana')).toBe(
      '/Users/ana/Library/Application Support/browser-recorder',
    );
  });

  it('uses LOCALAPPDATA on Windows and falls back to the home', () => {
    expect(
      appDataRootFor('win32', { LOCALAPPDATA: 'C:\\L' }, 'C:\\Users\\ana'),
    ).toBe('C:\\L\\browser-recorder');
    expect(appDataRootFor('win32', {}, 'C:\\Users\\ana')).toBe(
      'C:\\Users\\ana\\AppData\\Local\\browser-recorder',
    );
  });

  it('uses XDG_DATA_HOME on Linux and falls back to ~/.local/share', () => {
    expect(appDataRootFor('linux', { XDG_DATA_HOME: '/x' }, '/home/ana')).toBe(
      '/x/browser-recorder',
    );
    expect(appDataRootFor('linux', {}, '/home/ana')).toBe(
      '/home/ana/.local/share/browser-recorder',
    );
  });

  it('treats an empty variable as unset', () => {
    expect(appDataRootFor('linux', { XDG_DATA_HOME: '' }, '/home/ana')).toBe(
      '/home/ana/.local/share/browser-recorder',
    );
  });
});

describe('createProfileLayout', () => {
  it('keeps one managed directory and one sessions root per browser', () => {
    const layout = createProfileLayout('linux', '/data/browser-recorder');
    expect(layout.managedDir('brave')).toBe(
      '/data/browser-recorder/profiles/brave/managed',
    );
    expect(layout.sessionsRoot('brave')).toBe(
      '/data/browser-recorder/profiles/brave/sessions',
    );
    expect(layout.managedDir('chrome')).not.toBe(layout.managedDir('brave'));
  });

  it('joins with backslashes on Windows', () => {
    const layout = createProfileLayout('win32', 'C:\\data');
    expect(layout.managedDir('edge')).toBe('C:\\data\\profiles\\edge\\managed');
  });
});

describe('joinPath', () => {
  it('collapses duplicate separators at the seams', () => {
    expect(joinPath('linux', '/a/', 'b')).toBe('/a/b');
    expect(joinPath('win32', 'C:\\a\\', 'b')).toBe('C:\\a\\b');
  });
});

describe('SAFE_PROFILE_DIR', () => {
  it.each(['Default', 'Profile 1', 'Profile 2', 'Profile 1234'])(
    'accepts %s',
    (name) => {
      expect(SAFE_PROFILE_DIR.test(name)).toBe(true);
    },
  );

  it.each([
    '../x',
    'Default/../..',
    'C:\\x',
    '/abs',
    'Guest Profile',
    'Profile 12345',
    'Profile',
    'Default\n',
    '',
  ])('rejects %j', (name) => {
    expect(SAFE_PROFILE_DIR.test(name)).toBe(false);
  });
});
