import { vi } from 'vitest';
import type {
  BrowserLauncher,
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

export interface FakeSession extends BrowserSession {
  emit(signal: SessionSignal): void;
  readonly closeCount: () => number;
}

function createFakeSession(): FakeSession {
  let listener: (signal: SessionSignal) => void = () => undefined;
  const close = vi.fn(() => Promise.resolve());
  return {
    onSignal: (next) => {
      listener = next;
    },
    emit: (signal) => {
      listener(signal);
    },
    respondToDialog: () => Promise.resolve(),
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
