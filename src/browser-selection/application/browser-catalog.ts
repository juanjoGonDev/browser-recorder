import type { BrowserId } from '../../shared/domain/browser-choice.ts';

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
