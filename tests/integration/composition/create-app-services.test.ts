import { describe, expect, it } from 'vitest';
import { createAppServices } from '../../../src/composition/create-app-services.ts';
import type { AppServicesDeps } from '../../../src/composition/create-app-services.ts';
import { createLibraryService } from '../../../src/script-library/application/library-service.ts';
import { generateScript } from '../../../src/script-generation/domain/generate-script.ts';
import type {
  LiveRecordingView,
  RecordingUpdateView,
  ReplayView,
} from '../../../src/tui/domain/app-views.ts';
import {
  createFakeInstallation,
  createFakeLauncher,
  createFakeSpawner,
} from '../../support/composition-fakes.ts';
import { BUNDLED_CHOICE } from '../../support/browser-fixtures.ts';
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
}

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
  const services = createAppServices({
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
  return { services, repository, launcher, spawner, clock };
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
      ).resolves.toEqual({ kind: 'ready', linuxHint: null, browsers: [] });
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
        manualCommand: 'pnpm exec playwright install chromium',
        exitCode: 1,
      });
    });

    it('carries the Linux libraries hint on Linux', async () => {
      const { services } = setup({ platform: 'linux' });
      const view = await services.environment.ensureBrowser(() => undefined);
      expect(view).toMatchObject({ kind: 'ready' });
      expect(view.kind === 'ready' ? view.linuxHint : null).toContain(
        'playwright install-deps chromium',
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
    it('offers the bundled browser with an ephemeral profile', async () => {
      const { services } = setup();
      await expect(services.browsers.list()).resolves.toEqual([
        {
          browserId: 'bundled',
          label: 'Chromium (bundled)',
          profiles: [
            {
              choice: BUNDLED_CHOICE,
              label: 'Ephemeral (clean each time)',
              note: null,
            },
          ],
        },
      ]);
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
      expect((await services.replay.start('quiet')).warnings).toEqual([]);
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
            userDataDir: '',
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
      await services.replay.start('replayed');
      expect(spawner.children[0]?.request).toEqual({
        command: NODE_PATH,
        args: ['/library/replayed/script.mjs'],
        cwd: PACKAGE_ROOT,
        env: { BROWSER_RECORDER_HEADLESS: '1' },
      });
    });

    it('reports step drift as the script prints its markers', async () => {
      const { services, spawner } = await recorded();
      const live = await services.replay.start('replayed');
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

    it('finishes as succeeded when the script exits cleanly', async () => {
      const { services, spawner } = await recorded();
      const live = await services.replay.start('replayed');
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
      const live = await services.replay.start('replayed');
      spawner.children[0]?.stdout('::error 1 "locator not found"\n');
      spawner.children[0]?.exit(1);
      await expect(live.finished).resolves.toMatchObject({
        status: 'failed',
        errorMessage: 'locator not found',
      });
    });

    it('asks the script to abort when cancelled', async () => {
      const { services, spawner } = await recorded();
      const live = await services.replay.start('replayed');
      const cancelled = live.cancel();
      expect(spawner.children[0]?.stdin).toEqual(['abort\n']);
      spawner.children[0]?.exit(130);
      await cancelled;
      await expect(live.finished).resolves.toMatchObject({
        status: 'cancelled',
      });
    });

    it('rejects an unknown recording with a readable error', async () => {
      const { services } = setup();
      await expect(services.replay.start('missing')).rejects.toThrow();
    });
  });
});
