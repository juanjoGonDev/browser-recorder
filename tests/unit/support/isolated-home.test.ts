import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultBrowsersPath,
  isolatedEnvironment,
} from '../../support/isolated-home.ts';

describe('tests/support/isolated-home.ts', () => {
  describe('defaultBrowsersPath', () => {
    it('keeps an explicit PLAYWRIGHT_BROWSERS_PATH as it is', () => {
      expect(
        defaultBrowsersPath(
          'darwin',
          { PLAYWRIGHT_BROWSERS_PATH: '/pinned' },
          '/h',
        ),
      ).toBe('/pinned');
    });

    it('uses the macOS cache folder under the home directory', () => {
      expect(defaultBrowsersPath('darwin', {}, '/Users/ana')).toBe(
        path.join('/Users/ana', 'Library', 'Caches', 'ms-playwright'),
      );
    });

    it('prefers XDG_CACHE_HOME on Linux and falls back to ~/.cache', () => {
      expect(
        defaultBrowsersPath('linux', { XDG_CACHE_HOME: '/xdg' }, '/home/ana'),
      ).toBe(path.join('/xdg', 'ms-playwright'));
      expect(defaultBrowsersPath('linux', {}, '/home/ana')).toBe(
        path.join('/home/ana', '.cache', 'ms-playwright'),
      );
    });

    it('prefers LOCALAPPDATA on Windows and falls back to AppData\\Local', () => {
      expect(
        defaultBrowsersPath(
          'win32',
          { LOCALAPPDATA: 'C:\\L' },
          'C:\\Users\\ana',
        ),
      ).toBe(path.join('C:\\L', 'ms-playwright'));
      expect(defaultBrowsersPath('win32', {}, 'C:\\Users\\ana')).toBe(
        path.join('C:\\Users\\ana', 'AppData', 'Local', 'ms-playwright'),
      );
    });
  });

  describe('isolatedEnvironment', () => {
    const root = path.join('/tmp', 'iso');

    it('points every home and data variable inside the root', () => {
      const environment = isolatedEnvironment(root);
      expect(Object.keys(environment).sort()).toEqual([
        'APPDATA',
        'HOME',
        'LOCALAPPDATA',
        'USERPROFILE',
        'XDG_CACHE_HOME',
        'XDG_CONFIG_HOME',
        'XDG_DATA_HOME',
        'XDG_STATE_HOME',
      ]);
      for (const value of Object.values(environment)) {
        expect(value.startsWith(root + path.sep)).toBe(true);
      }
    });

    it('shares one home between HOME and USERPROFILE and separates the rest', () => {
      const environment = isolatedEnvironment(root);
      expect(environment['USERPROFILE']).toBe(environment['HOME']);
      const others = Object.entries(environment)
        .filter(([name]) => name !== 'USERPROFILE')
        .map(([, value]) => value);
      expect(new Set(others).size).toBe(others.length);
    });
  });
});
