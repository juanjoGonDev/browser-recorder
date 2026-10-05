import type { LaunchTarget } from '../../src/recording-capture/application/ports/browser-launcher.ts';
import type { BrowserChoice } from '../../src/shared/domain/browser-choice.ts';
import type { Display } from '../../src/shared/domain/recording.ts';

/** The browser every new recording starts with: bundled, nothing persisted. */
export const BUNDLED_CHOICE: BrowserChoice = {
  browserId: 'bundled',
  profileMode: 'ephemeral',
  sourceProfile: null,
};

/** Where a bundled launch runs: no executable path, a throwaway directory. */
export const BUNDLED_TARGET: LaunchTarget = {
  executablePath: null,
  userDataDir: '/fixture/tmp/profile',
  browserArgs: [],
  shouldUseRealKeychain: false,
};

export const BRAVE_CHOICE: BrowserChoice = {
  browserId: 'brave',
  profileMode: 'managed',
  sourceProfile: null,
};

/** Paths are invented: no test launches them, they only travel as data. */
export const BRAVE_TARGET: LaunchTarget = {
  executablePath: '/fixture/Brave Browser',
  userDataDir: '/fixture/app-data/profiles/brave/managed',
  browserArgs: [],
  shouldUseRealKeychain: false,
};

export const WINDOW_DISPLAY: Display = {
  kind: 'window',
  width: 1280,
  height: 800,
};
