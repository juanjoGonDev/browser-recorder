import { afterEach, describe, expect, it, vi } from 'vitest';

import { startReplay } from '../../../src/replay/application/replay-runner.ts';
import type {
  ProcessSpawner,
  SpawnedProcess,
  SpawnRequest,
} from '../../../src/replay/application/ports/process-spawner.ts';
import type { ReplayProgress } from '../../../src/replay/domain/replay-progress.ts';

const GRACE_MS = 3000;

interface FakeProcess extends SpawnedProcess {
  stdout(chunk: string): void;
  stderr(chunk: string): void;
  exit(code: number | null): void;
  readonly stdinWrites: string[];
  readonly kills: { count: number };
}

function fakeProcess(): FakeProcess {
  const out: ((chunk: string) => void)[] = [];
  const err: ((chunk: string) => void)[] = [];
  const exits: ((code: number | null) => void)[] = [];
  const stdinWrites: string[] = [];
  const kills = { count: 0 };
  return {
    onStdout: (listener) => out.push(listener),
    onStderr: (listener) => err.push(listener),
    onExit: (listener) => exits.push(listener),
    writeStdin: (text) => stdinWrites.push(text),
    kill: () => {
      kills.count += 1;
    },
    stdout: (chunk) => {
      out.forEach((listener) => {
        listener(chunk);
      });
    },
    stderr: (chunk) => {
      err.forEach((listener) => {
        listener(chunk);
      });
    },
    exit: (code) => {
      exits.forEach((listener) => {
        listener(code);
      });
    },
    stdinWrites,
    kills,
  };
}

function setup(offsets: readonly number[] = [0, 400, 900]): {
  child: FakeProcess;
  requests: SpawnRequest[];
  run: ReturnType<typeof startReplay>;
} {
  const child = fakeProcess();
  const requests: SpawnRequest[] = [];
  const spawner: ProcessSpawner = {
    spawn: (request) => {
      requests.push(request);
      return child;
    },
  };
  const run = startReplay(
    { spawner, nodePath: '/usr/bin/node', cancelGraceMs: GRACE_MS },
    {
      scriptPath: '/repo/recordings/a b/script.mjs',
      cwd: '/repo',
      isHeadless: false,
      launchEnv: {},
      stepOffsetsMs: offsets,
    },
  );
  return { child, requests, run };
}

describe('startReplay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('spawns node with the script as one argument and no shell', () => {
    const { requests } = setup();

    expect(requests).toEqual([
      {
        command: '/usr/bin/node',
        args: ['/repo/recordings/a b/script.mjs'],
        cwd: '/repo',
        env: {},
      },
    ]);
  });

  it('sets the headless variable only when headless is requested', () => {
    const requests: SpawnRequest[] = [];
    const spawner: ProcessSpawner = {
      spawn: (request) => {
        requests.push(request);
        return fakeProcess();
      },
    };

    startReplay(
      { spawner, nodePath: 'node', cancelGraceMs: GRACE_MS },
      {
        scriptPath: 's',
        cwd: 'c',
        isHeadless: true,
        launchEnv: {},
        stepOffsetsMs: [],
      },
    );

    expect(requests[0]?.env).toEqual({ BROWSER_RECORDER_HEADLESS: '1' });
  });

  it('hands the launch environment to the script next to the headless flag', () => {
    const requests: SpawnRequest[] = [];
    const spawner: ProcessSpawner = {
      spawn: (request) => {
        requests.push(request);
        return fakeProcess();
      },
    };

    startReplay(
      { spawner, nodePath: 'node', cancelGraceMs: GRACE_MS },
      {
        scriptPath: 's',
        cwd: 'c',
        isHeadless: true,
        launchEnv: {
          BROWSER_RECORDER_EXECUTABLE_PATH: '/fixture/Brave Browser',
          BROWSER_RECORDER_USER_DATA_DIR: '',
        },
        stepOffsetsMs: [],
      },
    );

    expect(requests[0]?.env).toEqual({
      BROWSER_RECORDER_EXECUTABLE_PATH: '/fixture/Brave Browser',
      BROWSER_RECORDER_USER_DATA_DIR: '',
      BROWSER_RECORDER_HEADLESS: '1',
    });
  });

  it('never lets the launch environment turn headless off', () => {
    const requests: SpawnRequest[] = [];
    const spawner: ProcessSpawner = {
      spawn: (request) => {
        requests.push(request);
        return fakeProcess();
      },
    };

    startReplay(
      { spawner, nodePath: 'node', cancelGraceMs: GRACE_MS },
      {
        scriptPath: 's',
        cwd: 'c',
        isHeadless: true,
        launchEnv: { BROWSER_RECORDER_HEADLESS: '0' },
        stepOffsetsMs: [],
      },
    );

    expect(requests[0]?.env['BROWSER_RECORDER_HEADLESS']).toBe('1');
  });

  it('publishes progress as markers arrive, across chunk splits', () => {
    const { child, run } = setup();
    const seen: ReplayProgress[] = [];
    run.subscribe((progress) => seen.push(progress));

    child.stdout('::ste');
    child.stdout('p 1 410\r\n');

    expect(seen.at(-1)?.lastStepIndex).toBe(1);
    expect(seen.at(-1)?.steps[1]?.driftMs).toBe(10);
  });

  it('stops notifying after unsubscribe', () => {
    const { child, run } = setup();
    const listener = vi.fn();
    const unsubscribe = run.subscribe(listener);
    unsubscribe();

    child.stdout('::step 0 1\n');

    expect(listener).not.toHaveBeenCalled();
  });

  it('succeeds on exit code 0', async () => {
    const { child, run } = setup();
    child.stdout('::step 0 1\n::done 900\n');
    child.exit(0);

    const result = await run.finished;

    expect(result.status).toBe('succeeded');
    expect(result.steps.every((step) => step.status === 'done')).toBe(true);
  });

  it('fails with the step, script error and stderr tail', async () => {
    const { child, run } = setup();
    child.stdout('::step 1 400\n::error 1 "locator gone"\n');
    child.stderr('stack line 1\nstack line 2\n');
    child.exit(1);

    const result = await run.finished;

    expect(result).toMatchObject({
      status: 'failed',
      lastStepIndex: 1,
      exitCode: 1,
      errorMessage: 'locator gone',
      stderrTail: ['stack line 1', 'stack line 2'],
    });
  });

  it('flushes an unterminated final line on exit', async () => {
    const { child, run } = setup();
    child.stdout('::step 2 950');
    child.exit(1);

    expect((await run.finished).lastStepIndex).toBe(2);
  });

  it('fails without throwing when the spawner refuses to start', async () => {
    const spawner: ProcessSpawner = {
      spawn: () => {
        throw new Error('Replay script not found: /x/script.mjs');
      },
    };
    const run = startReplay(
      { spawner, nodePath: 'node', cancelGraceMs: GRACE_MS },
      {
        scriptPath: '/x/script.mjs',
        cwd: '/',
        isHeadless: false,
        launchEnv: {},
        stepOffsetsMs: [0],
      },
    );

    expect(await run.finished).toMatchObject({
      status: 'failed',
      errorMessage: 'Replay script not found: /x/script.mjs',
    });
    await expect(run.cancel()).resolves.toBeUndefined();
  });

  it('asks the script to abort and does not kill if it exits in time', async () => {
    vi.useFakeTimers();
    const { child, run } = setup();

    const cancelled = run.cancel();
    expect(child.stdinWrites).toEqual(['abort\n']);
    child.exit(130);
    await cancelled;
    await vi.advanceTimersByTimeAsync(GRACE_MS * 2);

    expect(child.kills.count).toBe(0);
    expect((await run.finished).status).toBe('cancelled');
  });

  it('kills the child once the grace period passes', async () => {
    vi.useFakeTimers();
    const { child, run } = setup();

    const cancelled = run.cancel();
    await vi.advanceTimersByTimeAsync(GRACE_MS - 1);
    expect(child.kills.count).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(child.kills.count).toBe(1);
    child.exit(null);
    await cancelled;

    expect((await run.finished).status).toBe('cancelled');
  });

  it('treats cancel after exit as a no-op', async () => {
    const { child, run } = setup();
    child.exit(0);
    await run.finished;

    await run.cancel();

    expect(child.stdinWrites).toEqual([]);
  });
});
