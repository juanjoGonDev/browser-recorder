import type { ProfileStore } from '../browser-profiles/application/profile-store.ts';
import type {
  BrowserCatalog,
  InstalledBrowser,
} from '../browser-selection/application/browser-catalog.ts';
import type { BrowserId } from '../shared/domain/browser-choice.ts';
import type {
  BrowserOptionView,
  ProfileOptionView,
} from '../tui/domain/app-views.ts';
import { describeProfileWarning } from './profile-messages.ts';

export interface BrowserViewsDeps {
  readonly catalog: BrowserCatalog;
  readonly profiles: ProfileStore;
  /** `process.platform`: only Windows has app-bound encryption. */
  readonly platform: string;
  /** Whether a browser holds this user data directory right now. */
  readonly isRunning: (userDataDir: string) => Promise<boolean>;
}

export interface BrowserViews {
  options(): Promise<readonly BrowserOptionView[]>;
  /** Display names of the detected browsers, for the setup screens. */
  labels(): Promise<readonly string[]>;
}

const MANAGED_LABEL = 'Managed (keeps logins)';
const EPHEMERAL_LABEL = 'Ephemeral (clean each time)';

function simpleOption(
  browserId: BrowserId,
  profileMode: 'managed' | 'ephemeral',
  label: string,
): ProfileOptionView {
  return {
    choice: { browserId, profileMode, sourceProfile: null },
    label,
    note: null,
  };
}

interface CopyFacts {
  readonly browserId: BrowserId;
  readonly isRunning: boolean;
  readonly hasAppBoundEncryption: boolean;
}

function copyNote(facts: CopyFacts): string | null {
  const notes: string[] = [];
  if (facts.isRunning) {
    notes.push(
      describeProfileWarning({ code: 'source-running' }, facts.browserId),
    );
  }
  if (facts.hasAppBoundEncryption) {
    notes.push(
      describeProfileWarning({ code: 'app-bound-encryption' }, facts.browserId),
    );
  }
  return notes.length === 0 ? null : notes.join(' ');
}

async function copyOptions(
  deps: BrowserViewsDeps,
  browser: InstalledBrowser,
): Promise<readonly ProfileOptionView[]> {
  const { userDataDir } = browser;
  if (userDataDir === null) return [];
  const info = await deps.profiles.listRealProfiles(userDataDir);
  if (info === null) return [];
  const note = copyNote({
    browserId: browser.browserId,
    isRunning: await deps.isRunning(userDataDir),
    // Only Windows encrypts cookies for the browser's own app.
    hasAppBoundEncryption:
      deps.platform === 'win32' && info.hasAppBoundEncryption,
  });
  return info.profiles.map((profile) => ({
    choice: {
      browserId: browser.browserId,
      profileMode: 'copy-of-real',
      sourceProfile: profile.directory,
    },
    label: `Copy of ${profile.displayName} (${profile.directory})`,
    note,
  }));
}

async function toOption(
  deps: BrowserViewsDeps,
  browser: InstalledBrowser,
): Promise<BrowserOptionView> {
  const { browserId } = browser;
  return {
    browserId,
    label: browser.label,
    profiles: [
      simpleOption(browserId, 'managed', MANAGED_LABEL),
      ...(await copyOptions(deps, browser)),
      simpleOption(browserId, 'ephemeral', EPHEMERAL_LABEL),
    ],
  };
}

/** What the new-recording form and the setup screens show of the catalogue. */
export function createBrowserViews(deps: BrowserViewsDeps): BrowserViews {
  return {
    async options() {
      const installed = await deps.catalog.list();
      return await Promise.all(
        installed.map((browser) => toOption(deps, browser)),
      );
    },
    async labels() {
      return (await deps.catalog.list()).map((browser) => browser.label);
    },
  };
}
