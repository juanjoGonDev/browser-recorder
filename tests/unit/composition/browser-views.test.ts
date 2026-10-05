import { describe, expect, it, vi } from 'vitest';
import { createBrowserViews } from '../../../src/composition/browser-views.ts';
import {
  BRAVE_INSTALLED,
  BUNDLED_INSTALLED,
  OPERA_INSTALLED,
  createFakeCatalog,
  createFakeProfiles,
} from '../../support/composition-fakes.ts';
import type { InstalledBrowser } from '../../../src/browser-selection/application/browser-catalog.ts';
import type { LocalStateInfo } from '../../../src/browser-profiles/domain/parse-local-state.ts';

const TWO_PROFILES: LocalStateInfo = {
  profiles: [
    { directory: 'Default', displayName: 'Person 1' },
    { directory: 'Profile 1', displayName: 'Work' },
  ],
  hasAppBoundEncryption: false,
};

interface Options {
  readonly installed?: readonly InstalledBrowser[];
  readonly local?: LocalStateInfo | null;
  readonly isRunning?: boolean;
  readonly platform?: string;
}

function setup(options: Options = {}) {
  const profiles = createFakeProfiles();
  profiles.realProfiles =
    options.local === undefined ? TWO_PROFILES : options.local;
  const isRunning = vi.fn(() => Promise.resolve(options.isRunning ?? false));
  const views = createBrowserViews({
    catalog: createFakeCatalog(
      options.installed ?? [BRAVE_INSTALLED, BUNDLED_INSTALLED],
    ),
    profiles,
    platform: options.platform ?? 'darwin',
    isRunning,
  });
  return { views, profiles, isRunning };
}

describe('src/composition/browser-views.ts', () => {
  describe('options', () => {
    it('offers managed, one copy per listed profile and ephemeral for a browser with a data folder', async () => {
      const { views } = setup();
      const [brave] = await views.options();
      expect(brave).toEqual({
        browserId: 'brave',
        label: 'Brave',
        profiles: [
          {
            choice: {
              browserId: 'brave',
              profileMode: 'managed',
              sourceProfile: null,
            },
            label: 'Managed (keeps logins)',
            note: null,
          },
          {
            choice: {
              browserId: 'brave',
              profileMode: 'copy-of-real',
              sourceProfile: 'Default',
            },
            label: 'Copy of Person 1 (Default)',
            note: null,
          },
          {
            choice: {
              browserId: 'brave',
              profileMode: 'copy-of-real',
              sourceProfile: 'Profile 1',
            },
            label: 'Copy of Work (Profile 1)',
            note: null,
          },
          {
            choice: {
              browserId: 'brave',
              profileMode: 'ephemeral',
              sourceProfile: null,
            },
            label: 'Ephemeral (clean each time)',
            note: null,
          },
        ],
      });
    });

    it('omits copy of the real profile for a browser without a data folder', async () => {
      const { views } = setup({
        installed: [OPERA_INSTALLED, BUNDLED_INSTALLED],
      });
      const [opera] = await views.options();
      expect(opera.profiles.map((profile) => profile.label)).toEqual([
        'Managed (keeps logins)',
        'Ephemeral (clean each time)',
      ]);
    });

    it('omits copies when Local State is missing or unreadable', async () => {
      const { views } = setup({ local: null });
      const [brave] = await views.options();
      expect(
        brave.profiles.map((profile) => profile.choice.profileMode),
      ).toEqual(['managed', 'ephemeral']);
    });

    it('lists the bundled browser last with managed and ephemeral only', async () => {
      const { views } = setup();
      const options = await views.options();
      expect(options.map((option) => option.browserId)).toEqual([
        'brave',
        'bundled',
      ]);
      const bundled = options.at(-1);
      expect(bundled?.label).toBe('Chromium (bundled)');
      expect(bundled?.profiles.map((profile) => profile.choice)).toEqual([
        { browserId: 'bundled', profileMode: 'managed', sourceProfile: null },
        { browserId: 'bundled', profileMode: 'ephemeral', sourceProfile: null },
      ]);
    });

    it('warns on every copy that the browser is running', async () => {
      const { views, isRunning } = setup({ isRunning: true });
      const [brave] = await views.options();
      const notes = brave.profiles.map((profile) => profile.note);
      expect(notes).toEqual([
        null,
        'Brave is running: the copy may miss its latest changes.',
        'Brave is running: the copy may miss its latest changes.',
        null,
      ]);
      expect(isRunning).toHaveBeenCalledWith('/fixture/real/brave');
    });

    it('warns about app-bound encryption on Windows only', async () => {
      const local = { ...TWO_PROFILES, hasAppBoundEncryption: true };
      const onWindows = await setup({
        local,
        platform: 'win32',
      }).views.options();
      expect(onWindows[0]?.profiles[1]?.note).toBe(
        'Brave protects its cookies with app-bound encryption: the copy will probably not be logged in.',
      );
      const onMac = await setup({ local, platform: 'darwin' }).views.options();
      expect(onMac[0]?.profiles[1]?.note).toBeNull();
    });

    it('joins both notes when the browser runs with app-bound encryption', async () => {
      const local = { ...TWO_PROFILES, hasAppBoundEncryption: true };
      const { views } = setup({ local, platform: 'win32', isRunning: true });
      const [brave] = await views.options();
      expect(brave.profiles[1]?.note).toBe(
        'Brave is running: the copy may miss its latest changes. Brave protects its cookies with app-bound encryption: the copy will probably not be logged in.',
      );
    });
  });

  describe('labels', () => {
    it('names every detected browser in catalogue order', async () => {
      const { views } = setup({
        installed: [BRAVE_INSTALLED, OPERA_INSTALLED, BUNDLED_INSTALLED],
      });
      await expect(views.labels()).resolves.toEqual([
        'Brave',
        'Opera',
        'Chromium (bundled)',
      ]);
    });
  });
});
