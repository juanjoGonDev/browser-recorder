import { vi } from 'vitest';
import type {
  BrowserLauncher,
  DialogResponse,
  BrowserSession,
  LaunchOptions,
  SessionSignal,
} from '../../src/recording-capture/application/ports/browser-launcher.ts';
import type {
  ProcessSpawner,
  SpawnedProcess,
  SpawnRequest,
} from '../../src/replay/application/ports/process-spawner.ts';
import type { BrowserInstallation } from '../../src/environment-setup/application/ports/browser-installation.ts';
import type { LocalStateInfo } from '../../src/browser-profiles/domain/parse-local-state.ts';
import type {
  PreparedProfile,
  PrepareProfileRequest,
  ProfileStore,
} from '../../src/browser-profiles/application/profile-store.ts';
import type {
  BrowserCatalog,
  InstalledBrowser,
} from '../../src/browser-selection/application/browser-catalog.ts';

export interface FakeSession extends BrowserSession {
  emit(signal: SessionSignal): void;
  readonly closeCount: () => number;
  readonly responses: DialogResponse[];
}

function createFakeSession(): FakeSession {
  let listener: (signal: SessionSignal) => void = () => undefined;
  const close = vi.fn(() => Promise.resolve());
  const responses: DialogResponse[] = [];
  return {
    responses,
    onSignal: (next) => {
      listener = next;
    },
    emit: (signal) => {
      listener(signal);
    },
    respondToDialog: (response) => {
      responses.push(response);
      return Promise.resolve();
    },
    close,
    closeCount: () => close.mock.calls.length,
  };
}

export interface FakeLauncher extends BrowserLauncher {
  readonly launches: LaunchOptions[];
  readonly sessions: FakeSession[];
  /** The next launch fails with this error. */
  failNextLaunch(error: Error): void;
}

export function createFakeLauncher(): FakeLauncher {
  const launches: LaunchOptions[] = [];
  const sessions: FakeSession[] = [];
  let failure: Error | null = null;
  return {
    launches,
    sessions,
    failNextLaunch(error) {
      failure = error;
    },
    launch(options) {
      launches.push(options);
      if (failure !== null) {
        const error = failure;
        failure = null;
        return Promise.reject(error);
      }
      const session = createFakeSession();
      sessions.push(session);
      return Promise.resolve(session);
    },
  };
}

export interface FakeChild extends SpawnedProcess {
  readonly request: SpawnRequest;
  readonly stdin: string[];
  stdout(chunk: string): void;
  stderr(chunk: string): void;
  exit(code: number | null): void;
  readonly killCount: () => number;
}

export interface FakeSpawner extends ProcessSpawner {
  readonly children: FakeChild[];
}

export function createFakeSpawner(): FakeSpawner {
  const children: FakeChild[] = [];
  return {
    children,
    spawn(request) {
      let onStdout: (chunk: string) => void = () => undefined;
      let onStderr: (chunk: string) => void = () => undefined;
      let onExit: (code: number | null) => void = () => undefined;
      const kill = vi.fn();
      const stdin: string[] = [];
      const child: FakeChild = {
        request,
        stdin,
        onStdout: (listener) => {
          onStdout = listener;
        },
        onStderr: (listener) => {
          onStderr = listener;
        },
        onExit: (listener) => {
          onExit = listener;
        },
        writeStdin: (text) => {
          stdin.push(text);
        },
        kill,
        killCount: () => kill.mock.calls.length,
        stdout: (chunk) => {
          onStdout(chunk);
        },
        stderr: (chunk) => {
          onStderr(chunk);
        },
        exit: (code) => {
          onExit(code);
        },
      };
      children.push(child);
      return child;
    },
  };
}

export interface FakeInstallation extends BrowserInstallation {
  readonly installs: () => number;
}

export function createFakeInstallation(options: {
  readonly isInstalled: boolean;
  readonly lines?: readonly string[];
  readonly exitCode?: number;
}): FakeInstallation {
  let isPresent = options.isInstalled;
  const install = vi.fn((onLine: (line: string) => void) => {
    for (const line of options.lines ?? []) onLine(line);
    isPresent = (options.exitCode ?? 0) === 0;
    return Promise.resolve({ exitCode: options.exitCode ?? 0 });
  });
  return {
    isInstalled: () => Promise.resolve(isPresent),
    install,
    installs: () => install.mock.calls.length,
  };
}

export const BRAVE_INSTALLED: InstalledBrowser = {
  browserId: 'brave',
  label: 'Brave',
  executablePath: '/fixture/Brave Browser',
  userDataDir: '/fixture/real/brave',
};

export const OPERA_INSTALLED: InstalledBrowser = {
  browserId: 'opera',
  label: 'Opera',
  executablePath: '/fixture/Opera',
  userDataDir: null,
};

export const BUNDLED_INSTALLED: InstalledBrowser = {
  browserId: 'bundled',
  label: 'Chromium (bundled)',
  executablePath: null,
  userDataDir: null,
};

/** A catalogue that lists exactly what it was given, in that order. */
export function createFakeCatalog(
  installed: readonly InstalledBrowser[],
): BrowserCatalog {
  return {
    list: () => Promise.resolve(installed),
    find: (id) =>
      Promise.resolve(installed.find((item) => item.browserId === id) ?? null),
  };
}

export interface FakeProfiles extends ProfileStore {
  readonly requests: PrepareProfileRequest[];
  readonly releases: () => number;
  /** What the next `prepare` returns (defaults to a managed directory). */
  nextPrepared: Partial<Omit<PreparedProfile, 'release'>>;
  /** The next `prepare` rejects with this. */
  failNextPrepare(error: Error): void;
  realProfiles: LocalStateInfo | null;
  sweeps: () => number;
}

export function createFakeProfiles(): FakeProfiles {
  const requests: PrepareProfileRequest[] = [];
  let releases = 0;
  let sweeps = 0;
  let failure: Error | null = null;
  const fake: FakeProfiles = {
    requests,
    releases: () => releases,
    sweeps: () => sweeps,
    nextPrepared: {},
    realProfiles: null,
    failNextPrepare(error) {
      failure = error;
    },
    listRealProfiles: () => Promise.resolve(fake.realProfiles),
    prepare(request) {
      requests.push(request);
      if (failure !== null) {
        const error = failure;
        failure = null;
        return Promise.reject(error);
      }
      return Promise.resolve({
        userDataDir: '/fixture/app-data/profiles/dir',
        browserArgs: [],
        shouldUseRealKeychain: false,
        warnings: [],
        ...fake.nextPrepared,
        release: () => {
          releases += 1;
          return Promise.resolve();
        },
      });
    },
    sweepStaleSessions() {
      sweeps += 1;
      return Promise.resolve();
    },
  };
  return fake;
}
