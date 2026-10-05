import { describe, expect, it } from 'vitest';
import { buildLaunchSettings } from '../../../src/recording-capture/domain/launch-arguments.ts';
import {
  BRAVE_TARGET,
  BUNDLED_TARGET,
  WINDOW_DISPLAY,
} from '../../support/browser-fixtures.ts';

const EMULATED = { kind: 'emulated', width: 800, height: 600 } as const;

describe('src/recording-capture/domain/launch-arguments.ts', () => {
  describe('display', () => {
    it('opens a real window: no emulated viewport, the size goes to the browser', () => {
      const settings = buildLaunchSettings(WINDOW_DISPLAY, BUNDLED_TARGET);
      expect(settings.viewport).toBeNull();
      expect(settings.args).toEqual(['--window-size=1280,800']);
    });

    it('emulates fixed metrics and adds no window size', () => {
      const settings = buildLaunchSettings(EMULATED, BUNDLED_TARGET);
      expect(settings.viewport).toEqual({ width: 800, height: 600 });
      expect(settings.args).toEqual([]);
    });
  });

  describe('browser arguments', () => {
    it('appends the arguments of the target after the window size', () => {
      const target = {
        ...BRAVE_TARGET,
        browserArgs: ['--profile-directory=Profile 2'],
      };
      expect(buildLaunchSettings(WINDOW_DISPLAY, target).args).toEqual([
        '--window-size=1280,800',
        '--profile-directory=Profile 2',
      ]);
      expect(buildLaunchSettings(EMULATED, target).args).toEqual([
        '--profile-directory=Profile 2',
      ]);
    });
  });

  describe('default arguments', () => {
    it('keeps the engine defaults unless the real keychain is needed', () => {
      expect(
        buildLaunchSettings(WINDOW_DISPLAY, BUNDLED_TARGET).ignoreDefaultArgs,
      ).toBeUndefined();
    });

    it('drops the two keychain switches for a copy of a real profile', () => {
      const target = { ...BRAVE_TARGET, shouldUseRealKeychain: true };
      expect(
        buildLaunchSettings(WINDOW_DISPLAY, target).ignoreDefaultArgs,
      ).toEqual(['--use-mock-keychain', '--password-store=basic']);
    });
  });

  describe('executable', () => {
    it('leaves the bundled browser to the engine', () => {
      expect(
        buildLaunchSettings(WINDOW_DISPLAY, BUNDLED_TARGET).executablePath,
      ).toBeUndefined();
    });

    it('launches the executable the composition resolved', () => {
      expect(
        buildLaunchSettings(WINDOW_DISPLAY, BRAVE_TARGET).executablePath,
      ).toBe('/fixture/Brave Browser');
    });
  });
});
