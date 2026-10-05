import { describe, expect, it } from 'vitest';

import {
  expandPath,
  type PathRoots,
} from '../../../src/browser-selection/domain/expand-path.ts';

const roots: PathRoots = {
  home: '/home/ana',
  localAppData: 'C:\\Users\\ana\\AppData\\Local',
  appData: 'C:\\Users\\ana\\AppData\\Roaming',
  programFiles: 'C:\\Program Files',
  programFilesX86: 'C:\\Program Files (x86)',
  xdgConfigHome: '/home/ana/cfg',
};

const noRoots: PathRoots = {
  home: '/home/ana',
  localAppData: null,
  appData: null,
  programFiles: null,
  programFilesX86: null,
  xdgConfigHome: null,
};

describe('expandPath', () => {
  it('fills in every root a template names', () => {
    expect(expandPath('{home}/Applications/Brave', roots)).toBe(
      '/home/ana/Applications/Brave',
    );
    expect(
      expandPath('{programFiles}\\Google\\Chrome\\chrome.exe', roots),
    ).toBe('C:\\Program Files\\Google\\Chrome\\chrome.exe');
    expect(expandPath('{programFilesX86}\\x', roots)).toBe(
      'C:\\Program Files (x86)\\x',
    );
    expect(expandPath('{localAppData}\\Vivaldi', roots)).toBe(
      'C:\\Users\\ana\\AppData\\Local\\Vivaldi',
    );
    expect(expandPath('{appData}\\Opera', roots)).toBe(
      'C:\\Users\\ana\\AppData\\Roaming\\Opera',
    );
    expect(expandPath('{xdgConfigHome}/chromium', roots)).toBe(
      '/home/ana/cfg/chromium',
    );
  });

  it('fills in a root used twice and leaves plain paths alone', () => {
    expect(expandPath('{home}/a/{home}', roots)).toBe('/home/ana/a//home/ana');
    expect(expandPath('/usr/bin/brave', roots)).toBe('/usr/bin/brave');
  });

  it('answers null when a root the template needs is missing', () => {
    expect(expandPath('{localAppData}\\Chromium', noRoots)).toBeNull();
    expect(expandPath('{programFiles}\\x', noRoots)).toBeNull();
    expect(expandPath('{home}/x/{appData}', noRoots)).toBeNull();
  });

  it('defaults the XDG config home to a folder under home', () => {
    expect(expandPath('{xdgConfigHome}/vivaldi', noRoots)).toBe(
      '/home/ana/.config/vivaldi',
    );
  });

  it('answers null for a placeholder it does not know', () => {
    expect(expandPath('{desktop}/x', roots)).toBeNull();
  });
});
