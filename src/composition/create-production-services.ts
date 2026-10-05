import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { nodeProcessProbe } from '../browser-profiles/adapters/node-process-probe.ts';
import { nodeProfileFileSystem } from '../browser-profiles/adapters/node-profile-file-system.ts';
import { createProfileStore } from '../browser-profiles/application/profile-store.ts';
import { createProfileLayout } from '../browser-profiles/domain/profile-layout.ts';
import { createNodeFileProbe } from '../browser-selection/adapters/node-file-probe.ts';
import { createBrowserCatalog } from '../browser-selection/application/browser-catalog.ts';
import { createPatchrightBrowserInstallation } from '../environment-setup/adapters/patchright-browser-installation.ts';
import { resolvePatchrightCli } from '../environment-setup/adapters/resolve-patchright-cli.ts';
import { createPerformanceClock } from '../recording-capture/adapters/performance-clock.ts';
import { createPatchrightBrowserLauncher } from '../recording-capture/adapters/patchright-browser-launcher.ts';
import type { BrowserLauncher } from '../recording-capture/application/ports/browser-launcher.ts';
import { nodeProcessSpawner } from '../replay/adapters/node-process-spawner.ts';
import { withScriptCheck } from '../replay/adapters/script-checking-spawner.ts';
import { createFileSystemRecordingRepository } from '../script-library/adapters/file-system-recording-repository.ts';
import { createLibraryService } from '../script-library/application/library-service.ts';
import { generateScript } from '../script-generation/domain/generate-script.ts';
import { createLaunchPlanner } from './browser-launch-plan.ts';
import { createBrowserViews } from './browser-views.ts';
import { createAppServices } from './create-app-services.ts';
import { pathRootsFor } from './path-roots.ts';
import { createRunningCheck, sleep } from './profile-runtime.ts';
import type {
  AppServicesDeps,
  ComposedServices,
} from './create-app-services.ts';
import { resolveAppPaths } from './resolve-paths.ts';
import type { AppPaths } from './resolve-paths.ts';

/** How long a replay gets to honour `abort` before it is killed. */
const CANCEL_GRACE_MS = 3000;

export interface ProductionOptions {
  readonly paths: AppPaths;
  readonly isHeadless: boolean;
  /** Replaces the Patchright launcher, for tests that need the page. */
  readonly launcher?: BrowserLauncher;
}

/** The app's paths, found from one of its own modules and the installed deps. */
export function resolveProductionPaths(moduleUrl: string): AppPaths {
  const nodeRequire = createRequire(moduleUrl);
  return resolveAppPaths(moduleUrl, {
    readText: (file) => readFileSync(file, 'utf8'),
    exists: existsSync,
    platform: process.platform,
    environment: process.env,
    homeDirectory: homedir(),
    resolveCli: () =>
      resolvePatchrightCli({
        resolve: (id) => nodeRequire.resolve(id),
        readText: (file) => readFileSync(file, 'utf8'),
        exists: existsSync,
      }),
  });
}

type BrowserFeatures = Pick<
  AppServicesDeps,
  'planner' | 'browserViews' | 'sweepStaleSessions'
>;

/** Browser detection and profiles, the two features only composition joins. */
function createBrowserFeatures(
  paths: AppPaths,
  installation: AppServicesDeps['installation'],
): BrowserFeatures {
  const { platform } = process;
  const profiles = createProfileStore({
    fs: nodeProfileFileSystem,
    processes: nodeProcessProbe,
    platform,
    layout: createProfileLayout(platform, paths.appDataRoot),
    sleep,
  });
  const catalog = createBrowserCatalog({
    probe: createNodeFileProbe(platform),
    platform,
    roots: pathRootsFor(process.env, homedir()),
    isBundledInstalled: () => installation.isInstalled(),
  });
  return {
    planner: createLaunchPlanner({ catalog, profiles }),
    browserViews: createBrowserViews({
      catalog,
      profiles,
      platform,
      isRunning: createRunningCheck(platform),
    }),
    sweepStaleSessions: () => profiles.sweepStaleSessions(),
  };
}

/** Real adapters behind every port: the only place they are put together. */
export function createProductionDeps(
  options: ProductionOptions,
): AppServicesDeps {
  const { paths } = options;
  const repository = createFileSystemRecordingRepository({
    root: paths.recordingsRoot,
  });
  const clock = createPerformanceClock();
  const installation = createPatchrightBrowserInstallation({
    cliPath: paths.patchrightCliPath,
    nodePath: process.execPath,
  });
  return {
    ...createBrowserFeatures(paths, installation),
    library: createLibraryService({
      repository,
      renderScript: generateScript,
      now: () => new Date(),
    }),
    launcher:
      options.launcher ??
      createPatchrightBrowserLauncher({
        clock,
        inPageScriptPath: paths.inPageScriptPath,
      }),
    clock,
    now: () => new Date(),
    installation,
    platform: process.platform,
    isHeadless: options.isHeadless,
    replay: {
      spawner: withScriptCheck(nodeProcessSpawner, existsSync),
      nodePath: process.execPath,
      cancelGraceMs: CANCEL_GRACE_MS,
      cwd: paths.packageRoot,
      scriptPathOf: (slug) => repository.scriptPath(slug),
    },
  };
}

export function createProductionServices(
  options: ProductionOptions,
): ComposedServices {
  return createAppServices(createProductionDeps(options));
}
