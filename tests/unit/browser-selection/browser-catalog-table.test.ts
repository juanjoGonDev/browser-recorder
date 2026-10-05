import { describe, expect, it } from 'vitest';

import {
  BROWSER_TABLES,
  type BrowserCandidate,
} from '../../../src/browser-selection/domain/browser-catalog-table.ts';
import type { Platform } from '../../../src/browser-selection/domain/expand-path.ts';

const platforms: readonly Platform[] = ['darwin', 'win32', 'linux'];

function candidate(platform: Platform, id: string): BrowserCandidate {
  const found = BROWSER_TABLES[platform].find((c) => c.browserId === id);
  if (found === undefined) throw new Error(`no ${id} on ${platform}`);
  return found;
}

const expectedOrder = [
  'brave',
  'chrome',
  'edge',
  'chromium',
  'vivaldi',
  'opera',
];

describe('BROWSER_TABLES', () => {
  it.each(platforms)(
    'lists the six browsers in picker order on %s',
    (platform) => {
      expect(BROWSER_TABLES[platform].map((c) => c.browserId)).toEqual(
        expectedOrder,
      );
    },
  );

  it('names macOS Brave in /Applications first, then in the user folder', () => {
    expect(candidate('darwin', 'brave')).toEqual({
      browserId: 'brave',
      label: 'Brave',
      executables: [
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        '{home}/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      ],
      userDataDir:
        '{home}/Library/Application Support/BraveSoftware/Brave-Browser',
    });
  });

  it('names the other macOS app bundles and data folders', () => {
    expect(candidate('darwin', 'chrome').executables[0]).toBe(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    );
    expect(candidate('darwin', 'chrome').userDataDir).toBe(
      '{home}/Library/Application Support/Google/Chrome',
    );
    expect(candidate('darwin', 'edge').executables[1]).toBe(
      '{home}/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    );
    expect(candidate('darwin', 'chromium').userDataDir).toBe(
      '{home}/Library/Application Support/Chromium',
    );
    expect(candidate('darwin', 'vivaldi').executables[0]).toBe(
      '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi',
    );
  });

  it('names Windows executables under each program root and the local app data', () => {
    expect(candidate('win32', 'brave')).toEqual({
      browserId: 'brave',
      label: 'Brave',
      executables: [
        '{programFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        '{programFilesX86}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        '{localAppData}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      ],
      userDataDir: '{localAppData}\\BraveSoftware\\Brave-Browser\\User Data',
    });
    expect(candidate('win32', 'chrome').executables[0]).toBe(
      '{programFiles}\\Google\\Chrome\\Application\\chrome.exe',
    );
    expect(candidate('win32', 'edge').userDataDir).toBe(
      '{localAppData}\\Microsoft\\Edge\\User Data',
    );
    expect(candidate('win32', 'chromium').executables).toEqual([
      '{localAppData}\\Chromium\\Application\\chrome.exe',
    ]);
    expect(candidate('win32', 'vivaldi').userDataDir).toBe(
      '{localAppData}\\Vivaldi\\User Data',
    );
  });

  it('names Linux binaries in a stable order and the XDG data folders', () => {
    expect(candidate('linux', 'brave')).toEqual({
      browserId: 'brave',
      label: 'Brave',
      executables: [
        '/usr/bin/brave-browser',
        '/usr/bin/brave',
        '/opt/brave.com/brave/brave',
      ],
      userDataDir: '{xdgConfigHome}/BraveSoftware/Brave-Browser',
    });
    expect(candidate('linux', 'chrome').executables).toEqual([
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/opt/google/chrome/chrome',
    ]);
    expect(candidate('linux', 'edge').executables).toEqual([
      '/usr/bin/microsoft-edge-stable',
      '/opt/microsoft/msedge/msedge',
    ]);
    expect(candidate('linux', 'chromium').userDataDir).toBe(
      '{xdgConfigHome}/chromium',
    );
    expect(candidate('linux', 'vivaldi').executables).toEqual([
      '/usr/bin/vivaldi-stable',
      '/opt/vivaldi/vivaldi',
    ]);
  });

  it('gives Opera no user data directory on any OS', () => {
    for (const platform of platforms) {
      expect(candidate(platform, 'opera').userDataDir).toBeNull();
    }
    expect(candidate('win32', 'opera').executables).toEqual([
      '{localAppData}\\Programs\\Opera\\opera.exe',
    ]);
    expect(candidate('linux', 'opera').executables).toEqual(['/usr/bin/opera']);
  });

  it('gives every other browser a user data directory and an executable', () => {
    for (const platform of platforms) {
      const others = BROWSER_TABLES[platform].filter(
        (c) => c.browserId !== 'opera',
      );
      expect(others).toHaveLength(5);
      for (const entry of others) {
        expect(entry.userDataDir).toMatch(
          /^\{(home|localAppData|xdgConfigHome)\}/,
        );
        expect(entry.executables.length).toBeGreaterThan(0);
      }
    }
  });
});
