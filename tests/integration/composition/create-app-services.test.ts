import {
  RECORDED_TIMING,
  humanTiming,
} from '../../../src/shared/domain/replay-timing.ts';
import { describe, expect, it, vi } from 'vitest';
import { ProfileInUseError } from '../../../src/browser-profiles/domain/profile-errors.ts';
import { createLaunchPlanner } from '../../../src/composition/browser-launch-plan.ts';
import { createBrowserViews } from '../../../src/composition/browser-views.ts';
import { createAppServices } from '../../../src/composition/create-app-services.ts';
import type { AppServicesDeps } from '../../../src/composition/create-app-services.ts';
import { createLibraryService } from '../../../src/script-library/application/library-service.ts';
import { generateScript } from '../../../src/script-generation/domain/generate-script.ts';
import type {
  LiveRecordingView,
  RecordingUpdateView,
  ReplayView,
} from '../../../src/tui/domain/app-views.ts';
import type { InstalledBrowser } from '../../../src/browser-selection/application/browser-catalog.ts';
import {
  BRAVE_INSTALLED,
  BUNDLED_INSTALLED,
  createFakeCatalog,
  createFakeInstallation,
  createFakeLauncher,
  createFakeProfiles,
  createFakeSpawner,
} from '../../support/composition-fakes.ts';
import {
  BRAVE_CHOICE,
  BUNDLED_CHOICE,
} from '../../support/browser-fixtures.ts';
import { createFakeClock } from '../../support/fake-clock.ts';
import { MemoryRecordingRepository } from '../../support/memory-recording-repository.ts';
import { clickPayload, domSignal } from '../../support/session-signals.ts';

const START_MS = 5000;
const NOW = new Date('2026-03-04T05:06:07.000Z');
const NODE_PATH = '/usr/bin/node';
const PACKAGE_ROOT = '/app';

interface Overrides {
  readonly installation?: AppServicesDeps['installation'];
  readonly platform?: string;
  readonly isHeadless?: boolean;
  readonly installed?: readonly InstalledBrowser[];
}

const PROFILE_DIR = '/fixture/app-data/profiles/dir';

function setup(overrides: Overrides = {}) {
  const repository = new MemoryRecordingRepository();
  const library = createLibraryService({
    repository,
    renderScript: generateScript,
    now: () => NOW,
  });
  const launcher = createFakeLauncher();
  const spawner = createFakeSpawner();
  const clock = createFakeClock(START_MS);
  const profiles = createFakeProfiles();
  const catalog = createFakeCatalog(overrides.installed ?? [BUNDLED_INSTALLED]);
  const services = createAppServices({
    planner: createLaunchPlanner({ catalog, profiles }),
    browserViews: createBrowserViews({
      catalog,
      profiles,
      platform: overrides.platform ?? 'darwin',
      isRunning: () => Promise.resolve(false),
    }),
    sweepStaleSessions: () => profiles.sweepStaleSessions(),
    library,
    launcher,
    clock,
    now: () => NOW,
    installation:
      overrides.installation ?? createFakeInstallation({ isInstalled: true }),
    platform: overrides.platform ?? 'darwin',
    isHeadless: overrides.isHeadless ?? false,
    replay: {
      spawner,
      nodePath: NODE_PATH,
      cancelGraceMs: 3000,
      cwd: PACKAGE_ROOT,
      scriptPathOf: (slug) => repository.scriptPath(slug),
    },
  });
  return { services, repository, launcher, spawner, clock, profiles };
}

function collect(live: LiveRecordingView): RecordingUpdateView[] {
  const updates: RecordingUpdateView[] = [];
  live.subscribe((update) => updates.push(update));
  return updates;
}

describe('src/composition/create-app-services.ts', () => {
  describe('environment', () => {
    it('is ready without installing when Chromium is present', async () => {
      const installation = createFakeInstallation({ isInstalled: true });
      const { services } = setup({ installation });
      const lines: string[] = [];
      await expect(
        services.environment.ensureBrowser((line) => lines.push(line)),
      ).resolves.toEqual({
        kind: 'ready',
        linuxHint: null,
        browsers: ['Chromium (bundled)'],
      });
      expect(installation.installs()).toBe(0);
      expect(lines).toEqual([]);
    });

    it('announces and streams the installation when Chromium is missing', async () => {
      const installation = createFakeInstallation({
        isInstalled: false,
        lines: ['downloading', 'done'],
      });
      const { services } = setup({ installation });
      const lines: string[] = [];
      const view = await services.environment.ensureBrowser((line) =>
        lines.push(line),
      );
      expect(view.kind).toBe('ready');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/not installed/i);
      expect(lines.slice(1)).toEqual(['downloading', 'done']);
    });

    it('fails with the manual command when the installer fails', async () => {
      const installation = createFakeInstallation({
        isInstalled: false,
        exitCode: 1,
      });
      const { services } = setup({ installation });
      await expect(
        services.environment.ensureBrowser(() => undefined),
      ).resolves.toEqual({
        kind: 'failed',
        manualCommand: 'pnpm exec patchright install chromium',
        exitCode: 1,
      });
    });

    it('carries the Linux libraries hint on Linux', async () => {
      const { services } = setup({ platform: 'linux' });
      const view = await services.environment.ensureBrowser(() => undefined);
      expect(view).toMatchObject({ kind: 'ready' });
      expect(view.kind === 'ready' ? view.linuxHint : null).toContain(
        'patchright install-deps chromium',
      );
    });
  });

  describe('library', () => {
    async function seed(services: ReturnType<typeof setup>['services']) {
      const first = await services.recording.start({
        name: 'First flow',
        startUrl: null,
        browser: BUNDLED_CHOICE,
      });
      await first.stop();
      const second = await services.recording.start({
        name: 'Second flow',
        startUrl: 'https://a.test/',
        browser: BUNDLED_CHOICE,
      });
      await second.stop();
    }

    it('lists valid recordings as entries with their step count', async () => {
      const { services, launcher, clock } = setup();
      const live = await services.recording.start({
        name: 'First flow',
        startUrl: null,
        browser: BUNDLED_CHOICE,
      });
      clock.advance(1500);
      launcher.sessions[0]?.emit(domSignal(clock.now(), clickPayload()));
      await live.stop();
      const entries = await services.library.list();
      expect(entries).toEqual([
        {
          kind: 'valid',
          slug: 'first-flow',
          name: 'First flow',
          createdAt: NOW.toISOString(),
          durationMs: 1500,
          stepCount: 1,
          browser: BUNDLED_CHOICE,
        },
      ]);
    });

    it('lists a corrupt entry as invalid instead of failing', async () => {
      const { services, repository } = setup();
      repository.files.set('broken', {
        recordingJson: '{"schemaVersion": 99}',
        scriptMjs: '',
      });
      const entries = await services.library.list();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ kind: 'invalid', slug: 'broken' });
    });

    it('loads a recording by slug', async () => {
      const { services } = setup();
      await seed(services);
      await expect(services.library.load('second-flow')).resolves.toMatchObject(
        { name: 'Second flow', startUrl: 'https://a.test/' },
      );
    });

    it('validates names and start URLs with the library rules', () => {
      const { services } = setup();
      expect(services.library.validateName('Fine name')).toBeNull();
      expect(services.library.validateName('   ')).toMatch(/required/i);
      expect(services.library.validateStartUrl('')).toBeNull();
      expect(services.library.validateStartUrl('https://a.test')).toBeNull();
      expect(services.library.validateStartUrl('ftp://a.test')).toMatch(
        /http/i,
      );
    });

    it('renames a recording and reports a conflict as an error message', async () => {
      const { services, repository } = setup();
      await seed(services);
      await services.library.rename('first-flow', 'Renamed flow');
      expect([...repository.files.keys()].sort()).toEqual([
        'renamed-flow',
        'second-flow',
      ]);
      await expect(
        services.library.rename('renamed-flow', 'Second flow'),
      ).rejects.toThrow(/already exists/);
    });

    it('removes a recording', async () => {
      const { services, repository } = setup();
      await seed(services);
      await services.library.remove('first-flow');
      expect([...repository.files.keys()]).toEqual(['second-flow']);
    });
  });

  describe('browsers', () => {
    it('offers the bundled browser with a managed and an ephemeral profile', async () => {
      const { services } = setup();
      const options = await services.browsers.list();
      expect(options).toHaveLength(1);
      expect(options[0]).toMatchObject({
        browserId: 'bundled',
        label: 'Chromium (bundled)',
      });
      expect(options[0]?.profiles.map((profile) => profile.label)).toEqual([
        'Managed (keeps logins)',
        'Ephemeral (clean each time)',
      ]);
    });

    it('lists an installed browser before the bundled one', async () => {
      const { services } = setup({
        installed: [BRAVE_INSTALLED, BUNDLED_INSTALLED],
      });
      const options = await services.browsers.list();
      expect(options.map((option) => option.browserId)).toEqual([
        'brave',
        'bundled',
      ]);
    });
  });

  describe('startup', () => {
    it('sweeps leftover sessions once when the services are created', () => {
      const { profiles } = setup();
      expect(profiles.sweeps()).toBe(1);
    });

    it('does not fail when the sweep does', () => {
      const profiles = createFakeProfiles();
      profiles.sweepStaleSessions = () => Promise.reject(new Error('denied'));
      const catalog = createFakeCatalog([BUNDLED_INSTALLED]);
      expect(() =>
        createAppServices({
          planner: createLaunchPlanner({ catalog, profiles }),
          browserViews: createBrowserViews({
            catalog,
            profiles,
            platform: 'darwin',
            isRunning: () => Promise.resolve(false),
          }),
          sweepStaleSessions: () => profiles.sweepStaleSessions(),
          library: createLibraryService({
            repository: new MemoryRecordingRepository(),
            renderScript: generateScript,
            now: () => NOW,
          }),
          launcher: createFakeLauncher(),
          clock: createFakeClock(START_MS),
          now: () => NOW,
          installation: createFakeInstallation({ isInstalled: true }),
          platform: 'darwin',
          isHeadless: true,
          replay: {
            spawner: createFakeSpawner(),
            nodePath: NODE_PATH,
            cancelGraceMs: 3000,
            cwd: PACKAGE_ROOT,
            scriptPathOf: () => '/x',
          },
        }),
      ).not.toThrow();
    });
  });

  describe('warnings', () => {
    it('starts a recording and a replay without warnings', async () => {
      const { services } = setup();
      const live = await services.recording.start({
        name: 'Quiet',
        startUrl: null,
        browser: BUNDLED_CHOICE,
      });
      await live.stop();
      expect(live.warnings).toEqual([]);
      expect(
        (await services.replay.start('quiet', RECORDED_TIMING)).warnings,
      ).toEqual([]);
    });
  });

  describe('recording', () => {
    it('reserves a library entry and launches the browser at the start URL', async () => {
      const { services, repository, launcher } = setup({ isHeadless: true });
      await services.recording.start({
        name: 'My flow',
        startUrl: 'https://a.test/',
        browser: BUNDLED_CHOICE,
      });
      expect(repository.files.has('my-flow')).toBe(true);
      expect(launcher.launches).toEqual([
        {
          startUrl: 'https://a.test/',
          display: { kind: 'window', width: 1280, height: 800 },
          isHeadless: true,
          target: {
            executablePath: null,
            userDataDir: PROFILE_DIR,
            browserArgs: [],
            shouldUseRealKeychain: false,
          },
        },
      ]);
    });

    it('publishes events and the pending dialog as views', async () => {
      const { services, launcher, clock } = setup();
      const live = await services.recording.start({
        name: 'Dialogs',
        startUrl: null,
        browser: BUNDLED_CHOICE,
      });
      const updates = collect(live);
      clock.advance(200);
      launcher.sessions[0]?.emit({
        kind: 'dialog-opened',
        receivedAt: clock.now(),
        pageId: 'page1',
        dialogType: 'prompt',
        message: 'Name?',
        defaultValue: 'anon',
      });
      expect(updates.at(-1)).toEqual({
        events: [],
        pendingDialog: {
          dialogType: 'prompt',
          message: 'Name?',
          defaultValue: 'anon',
        },
        isClosed: false,
      });
    });

    it('forwards the answer to a dialog to the browser', async () => {
      const { services, launcher } = setup();
      const live = await services.recording.start({
        name: 'Answers',
        startUrl: null,
        browser: BUNDLED_CHOICE,
      });
      await live.respondToDialog({ action: 'accept', promptText: 'abc' });
      expect(launcher.sessions[0]?.responses).toEqual([
        { action: 'accept', promptText: 'abc' },
      ]);
    });

    it('saves a complete recording and its script when stopped', async () => {
      const { services, launcher, clock, repository } = setup();
      const live = await services.recording.start({
        name: 'Saved flow',
        startUrl: null,
        browser: BUNDLED_CHOICE,
      });
      clock.advance(800);
      launcher.sessions[0]?.emit(domSignal(clock.now(), clickPayload()));
      await live.stop();
      const saved = repository.files.get('saved-flow');
      expect(JSON.parse(saved?.recordingJson ?? '{}')).toMatchObject({
        status: 'complete',
        events: [{ kind: 'click', offsetMs: 800 }],
      });
      expect(saved?.scriptMjs).toContain('rt.mark(0)');
      expect(launcher.sessions[0]?.closeCount()).toBe(1);
    });

    it('deletes the whole entry when the recording is discarded', async () => {
      const { services, repository, launcher } = setup();
      const live = await services.recording.start({
        name: 'Throwaway',
        startUrl: null,
        browser: BUNDLED_CHOICE,
      });
      await live.discard();
      expect(repository.files.size).toBe(0);
      expect(launcher.sessions[0]?.closeCount()).toBe(1);
    });

    it('removes the entry and explains a launch failure', async () => {
      const { services, repository, launcher } = setup();
      launcher.failNextLaunch(new Error('Chromium launch failed'));
      await expect(
        services.recording.start({
          name: 'Broken',
          startUrl: null,
          browser: BUNDLED_CHOICE,
        }),
      ).rejects.toThrow('Chromium launch failed');
      expect(repository.files.size).toBe(0);
    });

    it('adds the Linux hint to a launch failure about missing libraries', async () => {
      const { services, launcher } = setup({ platform: 'linux' });
      launcher.failNextLaunch(
        new Error('error while loading shared libraries: libnss3.so'),
      );
      await expect(
        services.recording.start({
          name: 'Broken',
          startUrl: null,
          browser: BUNDLED_CHOICE,
        }),
      ).rejects.toThrow(/install-deps chromium/);
    });

    it('persists the live recording on demand and then has nothing left to save', async () => {
      const { services, launcher, clock, repository } = setup();
      await services.recording.start({
        name: 'Interrupted',
        startUrl: null,
        browser: BUNDLED_CHOICE,
      });
      clock.advance(300);
      launcher.sessions[0]?.emit(domSignal(clock.now(), clickPayload()));
      await services.persistActiveRecording();
      expect(
        JSON.parse(repository.files.get('interrupted')?.recordingJson ?? '{}'),
      ).toMatchObject({ status: 'complete', events: [{ kind: 'click' }] });
      await expect(services.persistActiveRecording()).resolves.toBeUndefined();
    });

    it('forgets a recording that ended on its own', async () => {
      const { services, launcher, clock } = setup();
      await services.recording.start({
        name: 'Closed',
        startUrl: null,
        browser: BUNDLED_CHOICE,
      });
      clock.advance(10);
      launcher.sessions[0]?.emit({
        kind: 'browser-closed',
        receivedAt: clock.now(),
        pageId: 'page1',
      });
      await services.persistActiveRecording();
      expect(launcher.sessions[0]?.closeCount()).toBe(1);
    });
  });

  describe('launch plan', () => {
    const braveSetup: Overrides = {
      installed: [BRAVE_INSTALLED, BUNDLED_INSTALLED],
    };

    it('launches the stored browser on the prepared profile and saves the choice', async () => {
      const { services, launcher, repository, profiles } = setup(braveSetup);
      profiles.nextPrepared = { userDataDir: '/fixture/brave/managed' };
      const live = await services.recording.start({
        name: 'On Brave',
        startUrl: null,
        browser: BRAVE_CHOICE,
      });
      expect(launcher.launches[0]?.target).toEqual({
        executablePath: '/fixture/Brave Browser',
        userDataDir: '/fixture/brave/managed',
        browserArgs: [],
        shouldUseRealKeychain: false,
      });
      await live.stop();
      expect(
        JSON.parse(repository.files.get('on-brave')?.recordingJson ?? '{}'),
      ).toMatchObject({ browser: BRAVE_CHOICE });
    });

    it('shows the profile warnings on the live recording', async () => {
      const { services, profiles } = setup(braveSetup);
      profiles.nextPrepared = { warnings: [{ code: 'source-running' }] };
      const live = await services.recording.start({
        name: 'Warned',
        startUrl: null,
        browser: BRAVE_CHOICE,
      });
      expect(live.warnings).toEqual([
        'Brave is running: the copy may miss its latest changes.',
      ]);
    });

    it('records on the bundled browser and warns live when the chosen one is not installed', async () => {
      const { services, launcher, repository } = setup({
        installed: [BUNDLED_INSTALLED],
      });
      const live = await services.recording.start({
        name: 'No Brave',
        startUrl: null,
        browser: BRAVE_CHOICE,
      });
      expect(live.warnings).toEqual([
        'Brave is not installed here: recording on the bundled Chromium instead.',
      ]);
      expect(launcher.launches[0]?.target.executablePath).toBeNull();
      await live.stop();
      expect(
        JSON.parse(repository.files.get('no-brave')?.recordingJson ?? '{}'),
      ).toMatchObject({
        browser: {
          browserId: 'bundled',
          profileMode: 'managed',
          sourceProfile: null,
        },
      });
    });

    it('rejects a locked profile with a safe message and leaves no entry', async () => {
      const { services, profiles, repository, launcher } = setup(braveSetup);
      profiles.failNextPrepare(new ProfileInUseError('brave', '/secret/dir'));
      const failure = await services.recording
        .start({ name: 'Locked', startUrl: null, browser: BRAVE_CHOICE })
        .then(
          () => null,
          (error: unknown) => error as Error,
        );
      expect(failure?.message).toMatch(/Brave profile is in use/);
      expect(failure?.message).not.toContain('/secret');
      expect(repository.files.size).toBe(0);
      expect(launcher.launches).toEqual([]);
    });

    it('releases the profile when the browser fails to launch', async () => {
      const { services, profiles, launcher } = setup(braveSetup);
      launcher.failNextLaunch(new Error('boom'));
      await expect(
        services.recording.start({
          name: 'Boom',
          startUrl: null,
          browser: BRAVE_CHOICE,
        }),
      ).rejects.toThrow('boom');
      expect(profiles.releases()).toBe(1);
    });

    it('releases the profile once when the recording is stopped', async () => {
      const { services, profiles } = setup(braveSetup);
      const live = await services.recording.start({
        name: 'Stopped',
        startUrl: null,
        browser: BRAVE_CHOICE,
      });
      expect(profiles.releases()).toBe(0);
      await live.stop();
      expect(profiles.releases()).toBe(1);
    });

    it('releases the profile when the recording is discarded', async () => {
      const { services, profiles } = setup(braveSetup);
      const live = await services.recording.start({
        name: 'Dropped',
        startUrl: null,
        browser: BRAVE_CHOICE,
      });
      await live.discard();
      expect(profiles.releases()).toBe(1);
    });

    it('releases the profile when the browser is closed by the person recording', async () => {
      const { services, profiles, launcher, clock } = setup(braveSetup);
      await services.recording.start({
        name: 'Closed by hand',
        startUrl: null,
        browser: BRAVE_CHOICE,
      });
      clock.advance(10);
      launcher.sessions[0]?.emit({
        kind: 'browser-closed',
        receivedAt: clock.now(),
        pageId: 'page1',
      });
      await vi.waitFor(() => {
        expect(profiles.releases()).toBe(1);
      });
    });
  });

  describe('replay', () => {
    async function recorded(overrides: Overrides = {}) {
      const rig = setup(overrides);
      const live = await rig.services.recording.start({
        name: 'Replayed',
        startUrl: null,
        browser: BUNDLED_CHOICE,
      });
      rig.clock.advance(1000);
      rig.launcher.sessions[0]?.emit(
        domSignal(rig.clock.now(), clickPayload()),
      );
      rig.clock.advance(1000);
      rig.launcher.sessions[0]?.emit(
        domSignal(rig.clock.now(), clickPayload()),
      );
      await live.stop();
      return rig;
    }

    it('spawns node on the script of the recording, without a shell', async () => {
      const { services, spawner } = await recorded({ isHeadless: true });
      await services.replay.start('replayed', RECORDED_TIMING);
      expect(spawner.children[0]?.request).toEqual({
        command: NODE_PATH,
        args: ['/library/replayed/script.mjs'],
        cwd: PACKAGE_ROOT,
        env: {
          BROWSER_RECORDER_EXECUTABLE_PATH: '',
          BROWSER_RECORDER_USER_DATA_DIR: PROFILE_DIR,
          BROWSER_RECORDER_BROWSER_ARGS: '[]',
          BROWSER_RECORDER_REAL_KEYCHAIN: '',
          BROWSER_RECORDER_HEADLESS: '1',
          BROWSER_RECORDER_TIMING: 'recorded',
          BROWSER_RECORDER_HUMAN_DELAY: '',
        },
      });
    });

    it('reports step drift as the script prints its markers', async () => {
      const { services, spawner } = await recorded();
      const live = await services.replay.start('replayed', RECORDED_TIMING);
      const views: ReplayView[] = [];
      live.subscribe((view) => views.push(view));
      spawner.children[0]?.stdout('::step 0 1005\n::step 1 2090\n');
      expect(views.at(-1)).toEqual({
        status: 'running',
        steps: [
          { index: 0, status: 'done', driftMs: 5 },
          { index: 1, status: 'running', driftMs: 90 },
        ],
        errorMessage: null,
      });
    });

    it('paces the script by the timing the view asks for and reports no drift', async () => {
      const { services, spawner } = await recorded();
      const live = await services.replay.start(
        'replayed',
        humanTiming({ minMs: 10, maxMs: 20 }),
      );
      const views: ReplayView[] = [];
      live.subscribe((view) => views.push(view));
      spawner.children[0]?.stdout('::step 1 2090\n');
      expect(spawner.children[0]?.request.env).toMatchObject({
        BROWSER_RECORDER_TIMING: 'human',
        BROWSER_RECORDER_HUMAN_DELAY: '10-20',
      });
      expect(views.at(-1)?.steps[1]).toStrictEqual({
        index: 1,
        status: 'running',
        driftMs: null,
      });
    });

    it('finishes as succeeded when the script exits cleanly', async () => {
      const { services, spawner } = await recorded();
      const live = await services.replay.start('replayed', RECORDED_TIMING);
      spawner.children[0]?.stdout(
        '::step 0 1000\n::step 1 2000\n::done 2001\n',
      );
      spawner.children[0]?.exit(0);
      await expect(live.finished).resolves.toMatchObject({
        status: 'succeeded',
        errorMessage: null,
      });
    });

    it('finishes as failed with the script error', async () => {
      const { services, spawner } = await recorded();
      const live = await services.replay.start('replayed', RECORDED_TIMING);
      spawner.children[0]?.stdout('::error 1 "locator not found"\n');
      spawner.children[0]?.exit(1);
      await expect(live.finished).resolves.toMatchObject({
        status: 'failed',
        errorMessage: 'locator not found',
      });
    });

    it('asks the script to abort when cancelled', async () => {
      const { services, spawner } = await recorded();
      const live = await services.replay.start('replayed', RECORDED_TIMING);
      const cancelled = live.cancel();
      expect(spawner.children[0]?.stdin).toEqual(['abort\n']);
      spawner.children[0]?.exit(130);
      await cancelled;
      await expect(live.finished).resolves.toMatchObject({
        status: 'cancelled',
      });
    });

    it('sets the four browser variables for the stored browser', async () => {
      const rig = setup({
        installed: [BRAVE_INSTALLED, BUNDLED_INSTALLED],
        isHeadless: true,
      });
      rig.profiles.nextPrepared = { userDataDir: '/fixture/brave/managed' };
      const live = await rig.services.recording.start({
        name: 'Stored',
        startUrl: null,
        browser: BRAVE_CHOICE,
      });
      await live.stop();
      await rig.services.replay.start('stored', RECORDED_TIMING);
      expect(rig.spawner.children[0]?.request.env).toEqual({
        BROWSER_RECORDER_EXECUTABLE_PATH: '/fixture/Brave Browser',
        BROWSER_RECORDER_USER_DATA_DIR: '/fixture/brave/managed',
        BROWSER_RECORDER_BROWSER_ARGS: '[]',
        BROWSER_RECORDER_REAL_KEYCHAIN: '',
        BROWSER_RECORDER_HEADLESS: '1',
        BROWSER_RECORDER_TIMING: 'recorded',
        BROWSER_RECORDER_HUMAN_DELAY: '',
      });
    });

    it('regenerates the script before every replay', async () => {
      const { services, repository, spawner } = await recorded();
      repository.files.set('replayed', {
        recordingJson: repository.files.get('replayed')?.recordingJson ?? '',
        scriptMjs: "import 'playwright';",
      });
      await services.replay.start('replayed', RECORDED_TIMING);
      expect(repository.files.get('replayed')?.scriptMjs).toContain(
        'patchright',
      );
      expect(repository.files.get('replayed')?.scriptMjs).not.toContain(
        "'playwright'",
      );
      expect(spawner.children).toHaveLength(1);
    });

    it('warns on the live replay when the recorded browser is missing', async () => {
      const rig = setup({
        installed: [BRAVE_INSTALLED, BUNDLED_INSTALLED],
      });
      const live = await rig.services.recording.start({
        name: 'Was brave',
        startUrl: null,
        browser: BRAVE_CHOICE,
      });
      await live.stop();
      const withoutBrave = setup({ installed: [BUNDLED_INSTALLED] });
      withoutBrave.repository.files.set(
        'was-brave',
        rig.repository.files.get('was-brave') ?? {
          recordingJson: '',
          scriptMjs: '',
        },
      );
      const replay = await withoutBrave.services.replay.start(
        'was-brave',
        RECORDED_TIMING,
      );
      expect(replay.warnings).toEqual([
        'Brave is not installed here: replaying on the bundled Chromium instead.',
      ]);
      expect(withoutBrave.spawner.children[0]?.request.env).toMatchObject({
        BROWSER_RECORDER_EXECUTABLE_PATH: '',
      });
    });

    it('releases the profile once the replay has ended', async () => {
      const rig = setup({ installed: [BRAVE_INSTALLED, BUNDLED_INSTALLED] });
      const live = await rig.services.recording.start({
        name: 'Releasing',
        startUrl: null,
        browser: BRAVE_CHOICE,
      });
      await live.stop();
      const before = rig.profiles.releases();
      const replay = await rig.services.replay.start(
        'releasing',
        RECORDED_TIMING,
      );
      expect(rig.profiles.releases()).toBe(before);
      rig.spawner.children[0]?.exit(0);
      await replay.finished;
      await vi.waitFor(() => {
        expect(rig.profiles.releases()).toBe(before + 1);
      });
    });

    it('rejects a locked profile with a message and spawns nothing', async () => {
      const rig = setup({ installed: [BRAVE_INSTALLED, BUNDLED_INSTALLED] });
      const live = await rig.services.recording.start({
        name: 'Busy',
        startUrl: null,
        browser: BRAVE_CHOICE,
      });
      await live.stop();
      rig.profiles.failNextPrepare(new ProfileInUseError('brave', '/x'));
      await expect(
        rig.services.replay.start('busy', RECORDED_TIMING),
      ).rejects.toThrow(/Brave profile is in use/);
      expect(rig.spawner.children).toEqual([]);
    });

    it('rejects an unknown recording with a readable error', async () => {
      const { services } = setup();
      await expect(
        services.replay.start('missing', RECORDED_TIMING),
      ).rejects.toThrow();
    });
  });
});
