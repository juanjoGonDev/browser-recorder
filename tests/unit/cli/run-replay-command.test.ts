import { describe, expect, it } from 'vitest';

import { runReplayCommand } from '../../../src/cli/application/run-replay-command.ts';
import type { CliCommand } from '../../../src/cli/domain/interpret-arguments.ts';
import {
  RECORDED_TIMING,
  humanTiming,
} from '../../../src/shared/domain/replay-timing.ts';
import type { RecordingEvent } from '../../../src/shared/domain/recording-event.ts';
import {
  createFakeOutput,
  createFakeRun,
  createFakeServices,
  createFakeSignals,
  stepView,
  type FakeRun,
} from '../../support/cli-fakes.ts';

type ReplayCommand = Extract<CliCommand, { kind: 'replay' }>;

const TARGET = (description: string) => ({
  locator: { kind: 'css', selector: '#x' },
  nth: null,
  framePath: [],
  description,
});

const EVENTS = [
  { kind: 'goto', offsetMs: 0, pageId: 'page1', url: 'https://example.com/' },
  {
    kind: 'click',
    offsetMs: 500,
    pageId: 'page1',
    target: TARGET('Save button'),
    button: 'left',
    modifiers: [],
  },
  {
    kind: 'fill',
    offsetMs: 900,
    pageId: 'page1',
    target: TARGET('Password'),
    value: 'hunter2',
    isSensitive: true,
  },
] as unknown as RecordingEvent[];

const CHOICES = [
  { slug: 'demo', name: 'Demo' },
  { slug: 'login', name: 'Login' },
  { slug: 'login-2', name: 'login' },
];

function command(overrides: Partial<ReplayCommand> = {}): ReplayCommand {
  return {
    kind: 'replay',
    query: 'demo',
    timing: RECORDED_TIMING,
    isHeadless: false,
    ...overrides,
  };
}

function rig(options: { hasOutColor?: boolean; warnings?: string[] } = {}) {
  const run = createFakeRun(EVENTS, { warnings: options.warnings ?? [] });
  const services = createFakeServices(CHOICES, () => Promise.resolve(run));
  const output = createFakeOutput({
    hasOutColor: options.hasOutColor ?? false,
  });
  const signals = createFakeSignals();
  const execute = (replay: ReplayCommand = command()) =>
    runReplayCommand(replay, { services, output, signals });
  return { run, services, output, signals, execute };
}

const tick = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

async function settleLater<T>(promise: Promise<T>): Promise<T | 'pending'> {
  return Promise.race([
    promise,
    new Promise<'pending'>((resolve) => {
      setTimeout(() => {
        resolve('pending');
      }, 20);
    }),
  ]);
}

function succeed(run: FakeRun): void {
  run.emit(stepView(['running', 'pending', 'pending']));
  run.emit(stepView(['done', 'running', 'pending']));
  run.emit(stepView(['done', 'done', 'running']));
  run.finish({
    ...stepView(['done', 'done', 'done']),
    status: 'succeeded',
  });
  run.release();
}

describe('src/cli/application/run-replay-command.ts', () => {
  it('prints one line per step, then the success line, and exits 0', async () => {
    const { run, services, output, execute } = rig();
    services.clock.nowMs = 0;
    const done = execute();
    await tick();
    services.clock.nowMs = 4200;
    succeed(run);
    expect(await done).toBe(0);
    expect(output.stdout()).toBe(
      [
        '[1/3] goto https://example.com/ (100ms)',
        '[2/3] click Save button (200ms)',
        '[3/3] fill Password (300ms)',
        '✔ Demo replayed in 4.2s',
        '',
      ].join('\n'),
    );
    expect(output.stderr()).toBe('');
  });

  it('never prints a typed value', async () => {
    const { run, output, execute } = rig();
    const done = execute();
    await tick();
    succeed(run);
    await done;
    expect(output.stdout() + output.stderr()).not.toContain('hunter2');
  });

  it('prints each step once even when the final snapshot repeats them', async () => {
    const { run, output, execute } = rig();
    const done = execute();
    await tick();
    run.emit(stepView(['running', 'pending', 'pending']));
    run.emit(stepView(['running', 'pending', 'pending']));
    run.finish({ ...stepView(['done', 'done', 'done']), status: 'succeeded' });
    run.release();
    await done;
    expect(output.stdout().match(/\[1\/3\]/gu)).toHaveLength(1);
    expect(output.stdout().match(/\[3\/3\]/gu)).toHaveLength(1);
  });

  it('names the failing step on stderr with the script tail and exits 1', async () => {
    const { run, output, execute } = rig();
    const done = execute();
    await tick();
    run.emit(stepView(['done', 'running', 'pending']));
    run.finish({
      ...stepView(['done', 'running', 'pending']),
      status: 'failed',
      errorMessage: 'locator not found',
      stderrTail: ['stack line'],
    });
    run.release();
    expect(await done).toBe(1);
    expect(output.stderr()).toBe(
      '✖ Demo failed at step 2 (click): locator not found\n  stack line\n',
    );
    expect(output.stdout()).toContain('[2/3] click Save button');
    expect(output.stdout()).not.toContain('✔');
  });

  it('reports a failure before any step without a step number', async () => {
    const { run, output, execute } = rig();
    const done = execute();
    await tick();
    run.finish({
      ...stepView(['pending', 'pending', 'pending']),
      status: 'failed',
      errorMessage: 'The replay exited with code 1.',
    });
    run.release();
    expect(await done).toBe(1);
    expect(output.stderr()).toBe(
      '✖ Demo failed: The replay exited with code 1.\n',
    );
  });

  it('promotes the first error line of the script when it failed before any step', async () => {
    const { run, output, execute } = rig();
    const done = execute();
    await tick();
    run.finish({
      ...stepView(['pending', 'pending', 'pending']),
      status: 'failed',
      errorMessage: 'The replay exited with code 1.',
      stderrTail: [
        'node:internal/process',
        'Error: browserType.launch: Executable does not exist',
        '    at launch (file.js:1:1)',
      ],
    });
    run.release();
    expect(await done).toBe(1);
    expect(output.stderr()).toBe(
      '✖ Demo failed: Error: browserType.launch: Executable does not exist\n' +
        '  node:internal/process\n' +
        '      at launch (file.js:1:1)\n',
    );
  });

  it('keeps the generic summary when no stderr line is an error', async () => {
    const { run, output, execute } = rig();
    const done = execute();
    await tick();
    run.finish({
      ...stepView(['pending', 'pending', 'pending']),
      status: 'failed',
      errorMessage: 'The replay exited with code 1.',
      stderrTail: ['some banner'],
    });
    run.release();
    expect(await done).toBe(1);
    expect(output.stderr()).toBe(
      '✖ Demo failed: The replay exited with code 1.\n  some banner\n',
    );
  });

  it('waits for the profile release before it returns', async () => {
    const { run, execute } = rig();
    const done = execute();
    await tick();
    run.finish({ ...stepView(['done', 'done', 'done']), status: 'succeeded' });
    expect(await settleLater(done)).toBe('pending');
    run.release();
    expect(await done).toBe(0);
  });

  it('keeps the warnings on stderr and still replays', async () => {
    const { run, output, execute } = rig({
      warnings: [
        'Brave is not installed here: replaying on the bundled Chromium.',
      ],
    });
    const done = execute();
    await tick();
    succeed(run);
    expect(await done).toBe(0);
    expect(output.stderr()).toBe(
      '! Brave is not installed here: replaying on the bundled Chromium.\n',
    );
    expect(output.stdout()).not.toContain('Brave');
  });

  it('prints the warnings of the script on stderr and still succeeds', async () => {
    const { run, output, execute } = rig();
    const done = execute();
    await tick();
    run.finish({
      ...stepView(['done', 'done', 'done']),
      status: 'succeeded',
      warnings: [
        'Stopped waiting for the network after 5 s; 2 requests were still in flight',
      ],
    });
    run.release();
    expect(await done).toBe(0);
    expect(output.stderr()).toBe(
      '! Stopped waiting for the network after 5 s; 2 requests were still in flight\n',
    );
    expect(output.stdout()).toContain('✔ Demo replayed');
    expect(output.stdout()).not.toContain('Stopped waiting');
  });

  it('prints each script warning once, in order, after the launch warnings', async () => {
    const { run, output, execute } = rig({ warnings: ['launch note'] });
    const done = execute();
    await tick();
    run.emit({
      ...stepView(['done', 'running', 'pending']),
      warnings: ['early'],
    });
    run.finish({
      ...stepView(['done', 'done', 'done']),
      status: 'succeeded',
      warnings: ['early', 'late\u001b[31m'],
    });
    run.release();
    expect(await done).toBe(0);
    expect(output.stderr()).toBe('! launch note\n! early\n! late·[31m\n');
  });

  it('starts the replay with the timing and headless flag of the command', async () => {
    const { run, services, execute } = rig();
    const done = execute(
      command({
        timing: humanTiming({ minMs: 10, maxMs: 20 }),
        isHeadless: true,
      }),
    );
    await tick();
    succeed(run);
    await done;
    expect(services.starts).toStrictEqual([
      {
        slug: 'demo',
        options: {
          timing: humanTiming({ minMs: 10, maxMs: 20 }),
          isHeadless: true,
        },
      },
    ]);
  });

  it('exits 2 and starts nothing when no recording matches', async () => {
    const { services, output, execute } = rig();
    expect(await execute(command({ query: 'missing' }))).toBe(2);
    expect(services.starts).toStrictEqual([]);
    expect(output.stderr()).toContain('No recording matches "missing"');
    expect(output.stdout()).toBe('');
  });

  it('exits 2 and lists every candidate slug when the name is ambiguous', async () => {
    const { services, output, execute } = rig();
    expect(await execute(command({ query: 'LOGIN' }))).toBe(2);
    expect(services.starts).toStrictEqual([]);
    expect(output.stderr()).toContain('login');
    expect(output.stderr()).toContain('login-2');
  });

  it('reports a launch failure, with its text, and exits 1', async () => {
    const services = createFakeServices(CHOICES, () =>
      Promise.reject(
        new Error(
          'Chromium is not installed.\nInstall it with: pnpm exec patchright install chromium',
        ),
      ),
    );
    const output = createFakeOutput();
    const signals = createFakeSignals();
    const code = await runReplayCommand(command(), {
      services,
      output,
      signals,
    });
    expect(code).toBe(1);
    expect(output.stderr()).toContain(
      '✖ demo failed: Chromium is not installed.',
    );
    expect(output.stderr()).toContain(
      'Install it with: pnpm exec patchright install chromium',
    );
    expect(output.stdout()).toBe('');
  });

  it('cancels once on Ctrl+C and exits 130 even when the run then succeeds', async () => {
    const { run, output, signals, execute } = rig();
    const done = execute();
    await tick();
    signals.emit('SIGINT');
    signals.emit('SIGINT');
    expect(run.cancelCount()).toBe(1);
    run.finish({ ...stepView(['done', 'done', 'done']), status: 'succeeded' });
    run.release();
    expect(await done).toBe(130);
    expect(output.stderr()).toBe('■ Demo cancelled\n');
    expect(output.stdout()).not.toContain('✔');
  });

  it('exits 143 on SIGTERM', async () => {
    const { run, signals, execute } = rig();
    const done = execute();
    await tick();
    signals.emit('SIGTERM');
    run.finish({
      ...stepView(['done', 'running', 'pending']),
      status: 'cancelled',
    });
    run.release();
    expect(await done).toBe(143);
  });

  it('cancels at once when the signal arrived while the replay was starting', async () => {
    const run = createFakeRun(EVENTS);
    const signals = createFakeSignals();
    const output = createFakeOutput();
    let startNow: () => void = () => undefined;
    const services = createFakeServices(
      CHOICES,
      () =>
        new Promise((resolve) => {
          startNow = () => {
            resolve(run);
          };
        }),
    );
    const done = runReplayCommand(command(), { services, output, signals });
    await tick();
    signals.emit('SIGINT');
    startNow();
    await tick();
    expect(run.cancelCount()).toBe(1);
    run.finish({
      ...stepView(['pending', 'pending', 'pending']),
      status: 'cancelled',
    });
    run.release();
    expect(await done).toBe(130);
  });

  it('stops listening for signals when it is done', async () => {
    const { run, signals, execute } = rig();
    const done = execute();
    await tick();
    succeed(run);
    await done;
    expect(signals.listenerCount()).toBe(0);
  });

  it('paints the summary only when color is on', async () => {
    const plain = rig();
    const plainDone = plain.execute();
    await tick();
    succeed(plain.run);
    await plainDone;
    const colored = rig({ hasOutColor: true });
    const coloredDone = colored.execute();
    await tick();
    succeed(colored.run);
    await coloredDone;
    expect(plain.output.stdout()).not.toContain('\u001b[');
    expect(colored.output.stdout()).toContain('\u001b[32m✔ Demo replayed');
  });
});
