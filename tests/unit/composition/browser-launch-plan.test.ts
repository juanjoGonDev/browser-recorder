import { describe, expect, it } from 'vitest';
import {
  ProfileCopyError,
  ProfileInUseError,
} from '../../../src/browser-profiles/domain/profile-errors.ts';
import {
  createLaunchPlanner,
  toReplayEnvironment,
} from '../../../src/composition/browser-launch-plan.ts';
import {
  BRAVE_INSTALLED,
  BUNDLED_INSTALLED,
  createFakeCatalog,
  createFakeProfiles,
} from '../../support/composition-fakes.ts';
import {
  BRAVE_CHOICE,
  BRAVE_TARGET,
  BUNDLED_CHOICE,
  BUNDLED_TARGET,
} from '../../support/browser-fixtures.ts';
import type { BrowserChoice } from '../../../src/shared/domain/browser-choice.ts';

const COPY_CHOICE: BrowserChoice = {
  browserId: 'brave',
  profileMode: 'copy-of-real',
  sourceProfile: 'Profile 2',
};

function setup(installed = [BRAVE_INSTALLED, BUNDLED_INSTALLED]) {
  const profiles = createFakeProfiles();
  const planner = createLaunchPlanner({
    catalog: createFakeCatalog(installed),
    profiles,
  });
  return { profiles, planner };
}

describe('src/composition/browser-launch-plan.ts', () => {
  describe('forRecording', () => {
    it('plans a managed launch on the installed executable', async () => {
      const { planner, profiles } = setup();
      profiles.nextPrepared = {
        userDataDir: '/fixture/app-data/profiles/brave/managed',
      };
      const plan = await planner.forRecording(BRAVE_CHOICE);
      expect(plan.choice).toEqual(BRAVE_CHOICE);
      expect(plan.target).toEqual(BRAVE_TARGET);
      expect(plan.warnings).toEqual([]);
      expect(profiles.requests).toEqual([
        {
          browserId: 'brave',
          profileMode: 'managed',
          sourceProfile: null,
          realUserDataDir: '/fixture/real/brave',
        },
      ]);
    });

    it('launches the bundled browser without an executable path', async () => {
      const { planner, profiles } = setup();
      profiles.nextPrepared = { userDataDir: '/fixture/tmp/profile' };
      const plan = await planner.forRecording(BUNDLED_CHOICE);
      expect(plan.target).toEqual(BUNDLED_TARGET);
    });

    it('carries the arguments and the real keychain of a copied profile', async () => {
      const { planner, profiles } = setup();
      profiles.nextPrepared = {
        userDataDir: '/fixture/sessions/abc',
        browserArgs: ['--profile-directory=Profile 2'],
        shouldUseRealKeychain: true,
      };
      const plan = await planner.forRecording(COPY_CHOICE);
      expect(plan.target).toEqual({
        executablePath: '/fixture/Brave Browser',
        userDataDir: '/fixture/sessions/abc',
        browserArgs: ['--profile-directory=Profile 2'],
        shouldUseRealKeychain: true,
      });
      expect(profiles.requests[0]).toMatchObject({
        sourceProfile: 'Profile 2',
        realUserDataDir: '/fixture/real/brave',
      });
    });

    it('words every profile warning for the person recording', async () => {
      const { planner, profiles } = setup();
      profiles.nextPrepared = {
        warnings: [
          { code: 'source-running' },
          { code: 'app-bound-encryption' },
          { code: 'unstable-copy', files: ['Cookies', 'History'] },
        ],
      };
      const plan = await planner.forRecording(COPY_CHOICE);
      expect(plan.warnings).toEqual([
        'Brave is running: the copy may miss its latest changes.',
        'Brave protects its cookies with app-bound encryption: the copy will probably not be logged in.',
        'Cookies, History kept changing while copying: the copy may be incomplete.',
      ]);
    });

    it('releases the profile once however often the plan is released', async () => {
      const { planner, profiles } = setup();
      const plan = await planner.forRecording(BRAVE_CHOICE);
      await plan.release();
      await plan.release();
      expect(profiles.releases()).toBe(1);
    });

    it('refuses a browser that is not installed and prepares nothing', async () => {
      const { planner, profiles } = setup([BUNDLED_INSTALLED]);
      await expect(planner.forRecording(BRAVE_CHOICE)).rejects.toThrow(
        'Brave is not installed on this machine.',
      );
      expect(profiles.requests).toEqual([]);
    });

    it('explains a profile in use by naming the browser', async () => {
      const { planner, profiles } = setup();
      profiles.failNextPrepare(
        new ProfileInUseError('brave', '/fixture/app-data/profiles/brave'),
      );
      const failure = await planner.forRecording(BRAVE_CHOICE).then(
        () => null,
        (error: unknown) => error as Error,
      );
      expect(failure?.message).toBe(
        'The Brave profile is in use by another process. Close the browser or recording using it and try again.',
      );
      expect(failure?.message).not.toContain('/fixture');
    });

    it.each([
      [
        'source-in-use',
        'Brave is running and holds files of the profile to copy. Close it and try again.',
      ],
      [
        'source-missing',
        'The Brave profile to copy could not be found. Is Brave still installed?',
      ],
      [
        'unknown-profile',
        'That profile is not a profile of Brave. Pick another profile.',
      ],
    ] as const)('explains a failed copy (%s)', async (code, message) => {
      const { planner, profiles } = setup();
      profiles.failNextPrepare(new ProfileCopyError(code, 'Profile 2'));
      await expect(planner.forRecording(COPY_CHOICE)).rejects.toThrow(message);
    });

    it('lets any other failure through unchanged', async () => {
      const { planner, profiles } = setup();
      profiles.failNextPrepare(new Error('disk full'));
      await expect(planner.forRecording(BRAVE_CHOICE)).rejects.toThrow(
        'disk full',
      );
    });
  });

  describe('forReplay', () => {
    it('keeps the recorded browser and adds no warning when it is installed', async () => {
      const { planner } = setup();
      const plan = await planner.forReplay(BRAVE_CHOICE);
      expect(plan.choice).toEqual(BRAVE_CHOICE);
      expect(plan.target.executablePath).toBe('/fixture/Brave Browser');
      expect(plan.warnings).toEqual([]);
    });

    it('falls back to the bundled browser, naming the missing one', async () => {
      const { planner, profiles } = setup([BUNDLED_INSTALLED]);
      const plan = await planner.forReplay(BRAVE_CHOICE);
      expect(plan.choice).toEqual({
        browserId: 'bundled',
        profileMode: 'managed',
        sourceProfile: null,
      });
      expect(plan.target.executablePath).toBeNull();
      expect(plan.warnings).toEqual([
        'Brave is not installed here: replaying on the bundled Chromium instead.',
      ]);
      expect(profiles.requests[0]).toMatchObject({ browserId: 'bundled' });
    });

    it('replays a copy of a missing browser on a clean profile', async () => {
      const { planner, profiles } = setup([BUNDLED_INSTALLED]);
      const plan = await planner.forReplay(COPY_CHOICE);
      expect(plan.choice).toEqual({
        browserId: 'bundled',
        profileMode: 'ephemeral',
        sourceProfile: null,
      });
      expect(plan.warnings[0]).toContain('Brave is not installed here');
      expect(profiles.requests[0]).toMatchObject({
        profileMode: 'ephemeral',
        sourceProfile: null,
      });
    });

    it('treats an id the catalogue does not know as a missing browser', async () => {
      const { planner } = setup([BUNDLED_INSTALLED]);
      const plan = await planner.forReplay({
        ...BRAVE_CHOICE,
        browserId: 'netscape' as BrowserChoice['browserId'],
      });
      expect(plan.choice.browserId).toBe('bundled');
      expect(plan.warnings[0]).toContain('netscape');
    });

    it('keeps the profile warnings after the fallback one', async () => {
      const { planner, profiles } = setup([BRAVE_INSTALLED, BUNDLED_INSTALLED]);
      profiles.nextPrepared = { warnings: [{ code: 'source-running' }] };
      const plan = await planner.forReplay(COPY_CHOICE);
      expect(plan.warnings).toEqual([
        'Brave is running: the copy may miss its latest changes.',
      ]);
    });
  });

  describe('toReplayEnvironment', () => {
    it('sets all four variables for a stored browser', () => {
      expect(toReplayEnvironment(BRAVE_TARGET)).toEqual({
        BROWSER_RECORDER_EXECUTABLE_PATH: '/fixture/Brave Browser',
        BROWSER_RECORDER_USER_DATA_DIR:
          '/fixture/app-data/profiles/brave/managed',
        BROWSER_RECORDER_BROWSER_ARGS: '[]',
        BROWSER_RECORDER_REAL_KEYCHAIN: '',
      });
    });

    it('leaves the executable empty for the bundled browser so inherited values are overridden', () => {
      const environment = toReplayEnvironment(BUNDLED_TARGET);
      expect(environment['BROWSER_RECORDER_EXECUTABLE_PATH']).toBe('');
      expect(environment['BROWSER_RECORDER_USER_DATA_DIR']).toBe(
        '/fixture/tmp/profile',
      );
    });

    it('passes the arguments as a JSON array and the keychain as exactly 1', () => {
      const environment = toReplayEnvironment({
        executablePath: '/fixture/Chrome',
        userDataDir: '/fixture/sessions/a b',
        browserArgs: ['--profile-directory=Profile 2'],
        shouldUseRealKeychain: true,
      });
      expect(
        JSON.parse(environment['BROWSER_RECORDER_BROWSER_ARGS'] ?? ''),
      ).toEqual(['--profile-directory=Profile 2']);
      expect(environment['BROWSER_RECORDER_REAL_KEYCHAIN']).toBe('1');
      expect(environment['BROWSER_RECORDER_USER_DATA_DIR']).toBe(
        '/fixture/sessions/a b',
      );
    });
  });
});
