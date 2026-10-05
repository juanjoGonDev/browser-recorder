import { homedir } from 'node:os';
import path from 'node:path';
import { createNodeFileProbe } from '../../src/browser-selection/adapters/node-file-probe.ts';
import {
  createBrowserCatalog,
  type BrowserCatalog,
  type InstalledBrowser,
} from '../../src/browser-selection/application/browser-catalog.ts';
import { pathRootsFor } from '../../src/composition/path-roots.ts';
import { FIXTURE_PROFILES_ROOT } from './profile-fixtures.ts';

type Environment = Readonly<Record<string, string | undefined>>;

const REAL_BROWSER_VARIABLE = 'BROWSER_RECORDER_REAL_BROWSER_TESTS';
const REAL_BROWSER_PATH_VARIABLE = 'BROWSER_RECORDER_REAL_BROWSER_PATH';
const HEADED_VARIABLE = 'BROWSER_RECORDER_HEADED_TESTS';
const ENABLED = '1';

/** Real-browser tests are opt-in: a developer machine has the browsers. */
export function isRealBrowserEnabled(environment: Environment): boolean {
  return environment[REAL_BROWSER_VARIABLE] === ENABLED;
}

/** The sole manual override that lets a test open a window. */
export function isHeadedAllowed(environment: Environment): boolean {
  return environment[HEADED_VARIABLE] === ENABLED;
}

/**
 * The only profile directories a test may copy from are the made-up ones under
 * `tests/fixtures/profiles/`; the user's own profile is never a source.
 */
export function assertUnderFixtures(directory: string): string {
  const relative = path.relative(
    FIXTURE_PROFILES_ROOT,
    path.resolve(directory),
  );
  const isInside =
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  if (!isInside) {
    throw new Error(
      `Refusing to use ${directory}: real-browser tests only read profiles under tests/fixtures/profiles.`,
    );
  }
  return directory;
}

/**
 * The browser an opt-in test launches: `BROWSER_RECORDER_REAL_BROWSER_PATH`
 * when set, else the first installed browser of the catalogue. Its data
 * directory is replaced by a fixture, so nothing of the user's is ever read.
 */
export async function detectRealBrowser(
  environment: Environment,
  fixtureProfile: string,
): Promise<InstalledBrowser | null> {
  const source = assertUnderFixtures(fixtureProfile);
  const override = environment[REAL_BROWSER_PATH_VARIABLE];
  if (override !== undefined && override !== '') {
    return {
      browserId: 'brave',
      label: 'Brave',
      executablePath: override,
      userDataDir: source,
    };
  }
  const catalog = createBrowserCatalog({
    probe: createNodeFileProbe(process.platform),
    platform: process.platform,
    roots: pathRootsFor(environment, homedir()),
    isBundledInstalled: () => Promise.resolve(true),
  });
  // The home is isolated, so the browser's own data folder is never found
  // here: only its executable matters, the fixture stands in for the data.
  const found = (await catalog.list()).find(
    (browser) =>
      browser.browserId !== 'bundled' && browser.browserId !== 'opera',
  );
  return found === undefined ? null : { ...found, userDataDir: source };
}

const BUNDLED: InstalledBrowser = {
  browserId: 'bundled',
  label: 'Chromium (bundled)',
  executablePath: null,
  userDataDir: null,
};

/** A catalogue offering this browser, then the bundled one like the real one. */
export function catalogOf(browser: InstalledBrowser): BrowserCatalog {
  const installed = [browser, BUNDLED];
  return {
    list: () => Promise.resolve(installed),
    find: (id) =>
      Promise.resolve(installed.find((item) => item.browserId === id) ?? null),
  };
}
