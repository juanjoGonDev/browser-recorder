import type { BrowserId } from '../../shared/domain/browser-choice.ts';
import {
  BROWSER_TABLES,
  type BrowserCandidate,
} from '../domain/browser-catalog-table.ts';
import { expandPath, type PathRoots } from '../domain/expand-path.ts';
import type { FileProbe } from './ports/file-probe.ts';

export interface InstalledBrowser {
  readonly browserId: BrowserId;
  readonly label: string;
  /** `null` stands for the bundled Chromium. */
  readonly executablePath: string | null;
  /** `null` when a copy of the real profile cannot be offered. */
  readonly userDataDir: string | null;
}

export interface BrowserCatalog {
  list(): Promise<readonly InstalledBrowser[]>;
  find(id: BrowserId): Promise<InstalledBrowser | null>;
}

export interface BrowserCatalogDeps {
  readonly probe: FileProbe;
  /** `process.platform`; an OS without a table lists only the bundled one. */
  readonly platform: string;
  readonly roots: PathRoots;
  /** Reserved: the bundled browser is always offered, installed or not. */
  readonly isBundledInstalled: () => Promise<boolean>;
}

const bundledBrowser: InstalledBrowser = {
  browserId: 'bundled',
  label: 'Chromium (bundled)',
  executablePath: null,
  userDataDir: null,
};

function tableFor(platform: string): readonly BrowserCandidate[] {
  return Object.hasOwn(BROWSER_TABLES, platform)
    ? BROWSER_TABLES[platform as keyof typeof BROWSER_TABLES]
    : [];
}

async function firstExistingFile(
  templates: readonly string[],
  deps: BrowserCatalogDeps,
): Promise<string | null> {
  for (const template of templates) {
    const path = expandPath(template, deps.roots);
    if (path !== null && (await deps.probe.isFile(path))) return path;
  }
  return null;
}

async function existingDirectory(
  template: string | null,
  deps: BrowserCatalogDeps,
): Promise<string | null> {
  if (template === null) return null;
  const path = expandPath(template, deps.roots);
  return path !== null && (await deps.probe.isDirectory(path)) ? path : null;
}

async function detect(
  candidate: BrowserCandidate,
  deps: BrowserCatalogDeps,
): Promise<InstalledBrowser | null> {
  const executablePath = await firstExistingFile(candidate.executables, deps);
  if (executablePath === null) return null;
  return {
    browserId: candidate.browserId,
    label: candidate.label,
    executablePath,
    userDataDir: await existingDirectory(candidate.userDataDir, deps),
  };
}

/** Browsers found on this machine in table order, then the bundled one. */
export function createBrowserCatalog(deps: BrowserCatalogDeps): BrowserCatalog {
  async function list(): Promise<readonly InstalledBrowser[]> {
    const found = await Promise.all(
      tableFor(deps.platform).map((candidate) => detect(candidate, deps)),
    );
    return [...found.filter((b) => b !== null), bundledBrowser];
  }
  return {
    list,
    find: async (id) => (await list()).find((b) => b.browserId === id) ?? null,
  };
}
