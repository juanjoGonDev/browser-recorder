import type { BrowserId } from '../../shared/domain/browser-choice.ts';
import type { Platform } from './expand-path.ts';

/** Path templates for one browser; `{home}` and the like are filled in later. */
export interface BrowserCandidate {
  readonly browserId: Exclude<BrowserId, 'bundled'>;
  readonly label: string;
  readonly executables: readonly string[];
  /** `null` when the browser's data directory is not a profile container. */
  readonly userDataDir: string | null;
}

export type BrowserTables = Readonly<
  Record<Platform, readonly BrowserCandidate[]>
>;

type Candidate = BrowserCandidate;
type Id = Candidate['browserId'];

function entry(
  id: Id,
  label: string,
  paths: Pick<Candidate, 'executables' | 'userDataDir'>,
): Candidate {
  return { browserId: id, label, ...paths };
}

/** An app bundle under `/Applications`, then under the user's own folder. */
function macApp(bundle: string, binary: string): readonly string[] {
  const inside = `${bundle}.app/Contents/MacOS/${binary}`;
  return [`/Applications/${inside}`, `{home}/Applications/${inside}`];
}

function macData(folder: string | null): string | null {
  return folder === null
    ? null
    : `{home}/Library/Application Support/${folder}`;
}

/** The same relative install path under each place Windows installers use. */
function winEverywhere(relative: string): readonly string[] {
  return ['{programFiles}', '{programFilesX86}', '{localAppData}'].map(
    (root) => `${root}\\${relative}`,
  );
}

function winData(folder: string | null): string | null {
  return folder === null ? null : `{localAppData}\\${folder}`;
}

function linuxData(folder: string | null): string | null {
  return folder === null ? null : `{xdgConfigHome}/${folder}`;
}

const darwinTable: readonly Candidate[] = [
  entry('brave', 'Brave', {
    executables: macApp('Brave Browser', 'Brave Browser'),
    userDataDir: macData('BraveSoftware/Brave-Browser'),
  }),
  entry('chrome', 'Google Chrome', {
    executables: macApp('Google Chrome', 'Google Chrome'),
    userDataDir: macData('Google/Chrome'),
  }),
  entry('edge', 'Microsoft Edge', {
    executables: macApp('Microsoft Edge', 'Microsoft Edge'),
    userDataDir: macData('Microsoft Edge'),
  }),
  entry('chromium', 'Chromium', {
    executables: macApp('Chromium', 'Chromium'),
    userDataDir: macData('Chromium'),
  }),
  entry('vivaldi', 'Vivaldi', {
    executables: macApp('Vivaldi', 'Vivaldi'),
    userDataDir: macData('Vivaldi'),
  }),
  entry('opera', 'Opera', {
    executables: macApp('Opera', 'Opera'),
    userDataDir: macData(null),
  }),
];

const win32Table: readonly Candidate[] = [
  entry('brave', 'Brave', {
    executables: winEverywhere(
      'BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    ),
    userDataDir: winData('BraveSoftware\\Brave-Browser\\User Data'),
  }),
  entry('chrome', 'Google Chrome', {
    executables: winEverywhere('Google\\Chrome\\Application\\chrome.exe'),
    userDataDir: winData('Google\\Chrome\\User Data'),
  }),
  entry('edge', 'Microsoft Edge', {
    executables: winEverywhere('Microsoft\\Edge\\Application\\msedge.exe'),
    userDataDir: winData('Microsoft\\Edge\\User Data'),
  }),
  entry('chromium', 'Chromium', {
    executables: ['{localAppData}\\Chromium\\Application\\chrome.exe'],
    userDataDir: winData('Chromium\\User Data'),
  }),
  entry('vivaldi', 'Vivaldi', {
    executables: ['{localAppData}\\Vivaldi\\Application\\vivaldi.exe'],
    userDataDir: winData('Vivaldi\\User Data'),
  }),
  entry('opera', 'Opera', {
    executables: ['{localAppData}\\Programs\\Opera\\opera.exe'],
    userDataDir: winData(null),
  }),
];

const linuxTable: readonly Candidate[] = [
  entry('brave', 'Brave', {
    executables: [
      '/usr/bin/brave-browser',
      '/usr/bin/brave',
      '/opt/brave.com/brave/brave',
    ],
    userDataDir: linuxData('BraveSoftware/Brave-Browser'),
  }),
  entry('chrome', 'Google Chrome', {
    executables: [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/opt/google/chrome/chrome',
    ],
    userDataDir: linuxData('google-chrome'),
  }),
  entry('edge', 'Microsoft Edge', {
    executables: [
      '/usr/bin/microsoft-edge-stable',
      '/opt/microsoft/msedge/msedge',
    ],
    userDataDir: linuxData('microsoft-edge'),
  }),
  entry('chromium', 'Chromium', {
    executables: ['/usr/bin/chromium', '/usr/bin/chromium-browser'],
    userDataDir: linuxData('chromium'),
  }),
  entry('vivaldi', 'Vivaldi', {
    executables: ['/usr/bin/vivaldi-stable', '/opt/vivaldi/vivaldi'],
    userDataDir: linuxData('vivaldi'),
  }),
  entry('opera', 'Opera', {
    executables: ['/usr/bin/opera'],
    userDataDir: linuxData(null),
  }),
];

/**
 * Where each OS keeps the browsers, in picker order. Opera has no
 * `userDataDir`: its data folder is the profile itself, so a copy of a real
 * profile cannot be offered.
 */
export const BROWSER_TABLES: BrowserTables = {
  darwin: darwinTable,
  win32: win32Table,
  linux: linuxTable,
};
