import type { ArgumentTokenizer } from '../../src/cli/application/ports/argument-tokenizer.ts';
import type { CommandOutput } from '../../src/cli/application/ports/command-output.ts';
import type { InterruptSignals } from '../../src/cli/application/ports/interrupt-signals.ts';
import type {
  ReplayCommandServices,
  ReplayRun,
  RunView,
  StartOptions,
} from '../../src/cli/application/ports/replay-command-services.ts';
import type { InterruptSignal } from '../../src/cli/domain/exit-code.ts';
import type { RecordingChoice } from '../../src/cli/domain/find-recording.ts';
import type { RecordingEvent } from '../../src/shared/domain/recording-event.ts';

export interface FakeOutput extends CommandOutput {
  readonly stdout: () => string;
  readonly stderr: () => string;
  readonly flushCount: () => number;
}

export function createFakeOutput(
  options: { hasOutColor?: boolean; hasErrColor?: boolean } = {},
): FakeOutput {
  let out = '';
  let err = '';
  let flushes = 0;
  return {
    hasOutColor: options.hasOutColor ?? false,
    hasErrColor: options.hasErrColor ?? false,
    out: (text) => {
      out += text;
    },
    err: (text) => {
      err += text;
    },
    flush: () => {
      flushes += 1;
      return Promise.resolve();
    },
    stdout: () => out,
    stderr: () => err,
    flushCount: () => flushes,
  };
}

export interface FakeSignals extends InterruptSignals {
  emit(signal: InterruptSignal): void;
  readonly listenerCount: () => number;
}

export function createFakeSignals(): FakeSignals {
  const listeners = new Set<(signal: InterruptSignal) => void>();
  return {
    listen: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (signal) => {
      listeners.forEach((listener) => {
        listener(signal);
      });
    },
    listenerCount: () => listeners.size,
  };
}

export function stepView(
  statuses: readonly ('pending' | 'running' | 'done')[],
  extra: Partial<Omit<RunView, 'steps'>> = {},
): RunView {
  const reached = statuses.filter((status) => status !== 'pending').length;
  return {
    status: 'running',
    steps: statuses.map((status, index) => ({
      index,
      status,
      elapsedMs: status === 'pending' ? null : (index + 1) * 100,
    })),
    lastStepIndex: reached === 0 ? null : reached - 1,
    errorMessage: null,
    warnings: [],
    stderrTail: [],
    ...extra,
  };
}

export interface FakeRun extends ReplayRun {
  emit(view: RunView): void;
  finish(view: RunView): void;
  release(): void;
  readonly cancelCount: () => number;
}

export function createFakeRun(
  events: readonly RecordingEvent[],
  options: { name?: string; warnings?: readonly string[] } = {},
): FakeRun {
  const listeners = new Set<(view: RunView) => void>();
  let settle: (view: RunView) => void = () => undefined;
  let releaseNow: () => void = () => undefined;
  let cancels = 0;
  return {
    name: options.name ?? 'Demo',
    events,
    warnings: options.warnings ?? [],
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    cancel: () => {
      cancels += 1;
      return Promise.resolve();
    },
    finished: new Promise<RunView>((resolve) => {
      settle = resolve;
    }),
    released: new Promise<void>((resolve) => {
      releaseNow = resolve;
    }),
    emit: (view) => {
      listeners.forEach((listener) => {
        listener(view);
      });
    },
    finish: (view) => {
      listeners.forEach((listener) => {
        listener(view);
      });
      settle(view);
    },
    release: () => {
      releaseNow();
    },
    cancelCount: () => cancels,
  };
}

export interface FakeServices extends ReplayCommandServices {
  readonly starts: { slug: string; options: StartOptions }[];
  clock: { nowMs: number };
}

export function createFakeServices(
  choices: readonly RecordingChoice[],
  start: (slug: string) => Promise<ReplayRun>,
): FakeServices {
  const starts: { slug: string; options: StartOptions }[] = [];
  const clock = { nowMs: 0 };
  return {
    starts,
    clock,
    listRecordings: () => Promise.resolve(choices),
    startReplay: (slug, options) => {
      starts.push({ slug, options });
      return start(slug);
    },
    now: () => clock.nowMs,
  };
}

/** A tokenizer that returns a canned result and remembers its input. */
export function createFakeTokenizer(
  result: ReturnType<ArgumentTokenizer['tokenize']>,
): ArgumentTokenizer & { readonly calls: (readonly string[])[] } {
  const calls: (readonly string[])[] = [];
  return {
    calls,
    tokenize: (argv) => {
      calls.push(argv);
      return result;
    },
  };
}
