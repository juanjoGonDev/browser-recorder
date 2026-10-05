import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import type { ComposedServices } from '../../../src/composition/create-app-services.ts';
import {
  runTuiApp,
  type TuiAppDeps,
} from '../../../src/composition/run-tui-app.ts';
import { NOT_INTERACTIVE_MESSAGE } from '../../../src/tui/adapters/node-terminal.ts';
import type { TuiSessionDeps } from '../../../src/tui/application/tui-session.ts';

class FakeStream extends EventEmitter {
  isTTY: boolean | undefined;
  columns = 100;
  rows = 30;
  readonly written: string[] = [];
  constructor(isTty: boolean) {
    super();
    this.isTTY = isTty;
  }
  setRawMode = vi.fn();
  resume = vi.fn();
  pause = vi.fn();
  write(text: string): boolean {
    this.written.push(text);
    return true;
  }
}

class FakeProcess extends EventEmitter {
  readonly errors: string[] = [];
  readonly exitCodes: number[] = [];
  readonly stderr = {
    write: (text: string): boolean => {
      this.errors.push(text);
      return true;
    },
  };
  exit(code: number): void {
    this.exitCodes.push(code);
  }
}

function setup(
  options: {
    isTty?: boolean;
    nodeVersion?: string;
    session?: (deps: TuiSessionDeps) => Promise<void>;
  } = {},
) {
  const input = new FakeStream(options.isTty ?? true);
  const output = new FakeStream(options.isTty ?? true);
  const proc = new FakeProcess();
  const persist = vi.fn(() => Promise.resolve());
  const services = {
    persistActiveRecording: persist,
  } as unknown as ComposedServices;
  const createServices = vi.fn(() => services);
  const sessions: TuiSessionDeps[] = [];
  const deps: TuiAppDeps = {
    nodeVersion: options.nodeVersion ?? '22.13.0',
    input,
    output,
    process: proc,
    env: {},
    createServices,
    runSession: (session) => {
      sessions.push(session);
      return options.session?.(session) ?? Promise.resolve();
    },
  };
  return { deps, proc, persist, createServices, sessions, services };
}

describe('src/composition/run-tui-app.ts', () => {
  it('refuses a pipe with the interactive-terminal message and exits 1', async () => {
    const { deps, proc, createServices, sessions } = setup({ isTty: false });
    expect(await runTuiApp(deps)).toBe(1);
    expect(proc.errors).toStrictEqual([`${NOT_INTERACTIVE_MESSAGE}\n`]);
    expect(createServices).not.toHaveBeenCalled();
    expect(sessions).toHaveLength(0);
  });

  it('refuses an old Node before building anything', async () => {
    const { deps, proc, createServices } = setup({ nodeVersion: '18.0.0' });
    expect(await runTuiApp(deps)).toBe(1);
    expect(proc.errors[0]).toMatch(/Node\.js .* or newer; found 18\.0\.0/u);
    expect(createServices).not.toHaveBeenCalled();
  });

  it('runs the session on the services and returns 0 after the user quits', async () => {
    const { deps, sessions, services } = setup();
    expect(await runTuiApp(deps)).toBe(0);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.services).toBe(services);
  });

  it('saves the live recording before leaving on Ctrl+C from outside', async () => {
    const { deps, proc, persist } = setup({
      session: (session) => {
        session.terminal.enter();
        proc.emit('SIGINT');
        return Promise.resolve();
      },
    });
    await runTuiApp(deps);
    await vi.waitFor(() => {
      expect(proc.exitCodes).toStrictEqual([130]);
    });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('draws colored frames only when the environment allows color', async () => {
    const sizes = { columns: 80, rows: 24 };
    const colored = setup();
    await runTuiApp(colored.deps);
    const plain = setup();
    await runTuiApp({ ...plain.deps, env: { NO_COLOR: '1' } });
    const frameOf = (session: TuiSessionDeps | undefined): string =>
      session?.renderFrame(
        {
          screen: { kind: 'main-menu', selected: 0 },
          nowMs: 0,
          listRows: 10,
          linuxHint: null,
          isBrowserAvailable: true,
          isBundledMissing: false,
          detectedBrowsers: [],
          isQuitting: false,
        },
        sizes,
      ) ?? '';
    expect(frameOf(colored.sessions[0])).toMatch(/\u001b\[\d+m/u);
    expect(frameOf(plain.sessions[0])).not.toMatch(/\u001b\[\d+m/u);
  });
});
