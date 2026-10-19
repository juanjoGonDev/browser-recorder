import { createLaunchPlanner } from '../../src/composition/browser-launch-plan.ts';
import { createBrowserViews } from '../../src/composition/browser-views.ts';
import { createAppServices } from '../../src/composition/create-app-services.ts';
import type { AppServicesDeps } from '../../src/composition/create-app-services.ts';
import { createLibraryService } from '../../src/script-library/application/library-service.ts';
import { generateScript } from '../../src/script-generation/domain/generate-script.ts';
import type {
  LiveRecordingView,
  RecordingUpdateView,
} from '../../src/tui/domain/app-views.ts';
import type { InstalledBrowser } from '../../src/browser-selection/application/browser-catalog.ts';
import {
  BUNDLED_INSTALLED,
  createFakeCatalog,
  createFakeInstallation,
  createFakeLauncher,
  createFakeProfiles,
  createFakeSpawner,
} from './composition-fakes.ts';
import { createFakeClock } from './fake-clock.ts';
import { MemoryRecordingRepository } from './memory-recording-repository.ts';

export const START_MS = 5000;
export const NOW = new Date('2026-03-04T05:06:07.000Z');
export const NODE_PATH = '/usr/bin/node';
export const PACKAGE_ROOT = '/app';

export interface Overrides {
  readonly installation?: AppServicesDeps['installation'];
  readonly platform?: string;
  readonly isHeadless?: boolean;
  readonly installed?: readonly InstalledBrowser[];
}

export const PROFILE_DIR = '/fixture/app-data/profiles/dir';

export interface AppServicesRig {
  readonly services: ReturnType<typeof createAppServices>;
  readonly repository: MemoryRecordingRepository;
  readonly launcher: ReturnType<typeof createFakeLauncher>;
  readonly spawner: ReturnType<typeof createFakeSpawner>;
  readonly clock: ReturnType<typeof createFakeClock>;
  readonly profiles: ReturnType<typeof createFakeProfiles>;
}

export function setup(overrides: Overrides = {}): AppServicesRig {
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
    planner: createLaunchPlanner({ catalog, profiles, platform: 'linux' }),
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

export function collect(live: LiveRecordingView): RecordingUpdateView[] {
  const updates: RecordingUpdateView[] = [];
  live.subscribe((update) => updates.push(update));
  return updates;
}
