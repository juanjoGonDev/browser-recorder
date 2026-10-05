import { describeStep } from '../domain/describe-step.ts';
import { exitCodeFor, type InterruptSignal } from '../domain/exit-code.ts';
import { findRecording } from '../domain/find-recording.ts';
import {
  createPainter,
  formatCancelled,
  formatFailure,
  formatSuccess,
  formatWarning,
  type Painter,
} from '../domain/format-result.ts';
import { formatStepLine } from '../domain/format-step-line.ts';
import type { CliCommand } from '../domain/interpret-arguments.ts';
import type { CommandOutput } from './ports/command-output.ts';
import type { InterruptSignals } from './ports/interrupt-signals.ts';
import type {
  ReplayCommandServices,
  ReplayRun,
  RunView,
} from './ports/replay-command-services.ts';

export type ReplayCommand = Extract<CliCommand, { kind: 'replay' }>;

export interface ReplayCommandDeps {
  readonly services: ReplayCommandServices;
  readonly output: CommandOutput;
  readonly signals: InterruptSignals;
}

const EXIT_USAGE = exitCodeFor({ kind: 'usage' });
const EXIT_FAILURE = exitCodeFor({ kind: 'failure' });
const EXIT_SUCCESS = exitCodeFor({ kind: 'success' });
const FALLBACK_STEP_KIND = 'step';

/** The first Ctrl+C or SIGTERM cancels the run; later ones change nothing. */
interface InterruptWatch {
  received(): InterruptSignal | null;
  /** Cancels at once when a signal already arrived. */
  attach(run: ReplayRun): void;
  dispose(): void;
}

function cancelQuietly(run: ReplayRun): void {
  void run.cancel().catch(() => undefined);
}

function watchInterrupts(signals: InterruptSignals): InterruptWatch {
  let signal: InterruptSignal | null = null;
  let attached: ReplayRun | null = null;
  const stop = signals.listen((received) => {
    if (signal !== null) return;
    signal = received;
    if (attached !== null) cancelQuietly(attached);
  });
  return {
    received: () => signal,
    attach(run) {
      attached = run;
      if (signal !== null) cancelQuietly(run);
    },
    dispose: stop,
  };
}

function writeLines(write: (text: string) => void, lines: string[]): void {
  write(lines.map((line) => `${line}\n`).join(''));
}

type Resolution =
  | { readonly kind: 'slug'; readonly slug: string }
  | { readonly kind: 'exit'; readonly exitCode: number };

async function resolveRecording(
  query: string,
  deps: ReplayCommandDeps,
): Promise<Resolution> {
  const lookup = findRecording(await deps.services.listRecordings(), query);
  if (lookup.kind === 'found') return { kind: 'slug', slug: lookup.slug };
  const lines =
    lookup.kind === 'not-found'
      ? [`No recording matches "${query}". Open the library to see the names.`]
      : [
          `"${query}" matches more than one recording; use the slug of one:`,
          ...lookup.slugs.map((slug) => `  ${slug}`),
        ];
  writeLines((text) => {
    deps.output.err(text);
  }, lines);
  return { kind: 'exit', exitCode: EXIT_USAGE };
}

/** Prints each step once, the moment the script reports it. */
function createStepPrinter(
  run: ReplayRun,
  output: CommandOutput,
): (view: RunView) => void {
  let printed = -1;
  return (view) => {
    const reached = view.lastStepIndex ?? -1;
    for (let index = printed + 1; index <= reached; index += 1) {
      const event = run.events[index];
      if (event === undefined) continue;
      const step = describeStep(event);
      output.out(
        `${formatStepLine({
          index,
          total: run.events.length,
          kind: step.kind,
          target: step.target,
          elapsedMs: view.steps[index]?.elapsedMs ?? null,
        })}\n`,
      );
    }
    printed = Math.max(printed, reached);
  };
}

function reportFailure(
  run: ReplayRun,
  view: RunView,
  painter: Painter,
): string[] {
  const index = view.lastStepIndex;
  const kind = index === null ? undefined : run.events[index]?.kind;
  const [, ...moreMessage] = (view.errorMessage ?? '').split('\n');
  return formatFailure(
    {
      name: run.name,
      step: index === null ? null : { index, kind: kind ?? FALLBACK_STEP_KIND },
      message: view.errorMessage ?? 'The replay failed.',
      stderrTail: [...moreMessage, ...view.stderrTail],
    },
    painter,
  );
}

function conclude(
  run: ReplayRun,
  view: RunView,
  context: { readonly deps: ReplayCommandDeps; readonly elapsedMs: number },
): number {
  const { output } = context.deps;
  const outPainter = createPainter(output.hasOutColor);
  const errPainter = createPainter(output.hasErrColor);
  if (view.status === 'succeeded') {
    output.out(`${formatSuccess(run.name, context.elapsedMs, outPainter)}\n`);
    return EXIT_SUCCESS;
  }
  if (view.status === 'cancelled') {
    output.err(`${formatCancelled(run.name, errPainter)}\n`);
    return exitCodeFor({ kind: 'interrupted', signal: 'SIGINT' });
  }
  writeLines(
    (text) => {
      output.err(text);
    },
    reportFailure(run, view, errPainter),
  );
  return EXIT_FAILURE;
}

async function startOrReport(
  command: ReplayCommand,
  slug: string,
  deps: ReplayCommandDeps,
): Promise<ReplayRun | null> {
  try {
    return await deps.services.startReplay(slug, {
      timing: command.timing,
      isHeadless: command.isHeadless,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const [, ...rest] = message.split('\n');
    writeLines(
      (text) => {
        deps.output.err(text);
      },
      formatFailure(
        { name: slug, step: null, message, stderrTail: rest },
        createPainter(deps.output.hasErrColor),
      ),
    );
    return null;
  }
}

async function runResolved(
  command: ReplayCommand,
  slug: string,
  context: {
    readonly deps: ReplayCommandDeps;
    readonly watch: InterruptWatch;
  },
): Promise<number> {
  const { deps, watch } = context;
  const startedAtMs = deps.services.now();
  const run = await startOrReport(command, slug, deps);
  if (run === null) return interruptedOr(watch, EXIT_FAILURE);
  watch.attach(run);
  run.warnings.forEach((warning) => {
    deps.output.err(`${formatWarning(warning)}\n`);
  });
  const print = createStepPrinter(run, deps.output);
  const unsubscribe = run.subscribe(print);
  const view = await run.finished;
  unsubscribe();
  print(view);
  await run.released;
  const signal = watch.received();
  if (signal !== null) {
    const painter = createPainter(deps.output.hasErrColor);
    deps.output.err(`${formatCancelled(run.name, painter)}\n`);
    return exitCodeFor({ kind: 'interrupted', signal });
  }
  const elapsedMs = deps.services.now() - startedAtMs;
  return conclude(run, view, { deps, elapsedMs });
}

/** An interrupt wins over whatever status the child ended with. */
function interruptedOr(watch: InterruptWatch, exitCode: number): number {
  const signal = watch.received();
  return signal === null
    ? exitCode
    : exitCodeFor({ kind: 'interrupted', signal });
}

/**
 * Replays one recording and returns the exit code. Output goes through the
 * port and the process ends only after the profile copy was deleted.
 */
export async function runReplayCommand(
  command: ReplayCommand,
  deps: ReplayCommandDeps,
): Promise<number> {
  const watch = watchInterrupts(deps.signals);
  try {
    const resolution = await resolveRecording(command.query, deps);
    if (resolution.kind === 'exit') return resolution.exitCode;
    if (watch.received() !== null) return interruptedOr(watch, EXIT_FAILURE);
    return await runResolved(command, resolution.slug, { deps, watch });
  } finally {
    watch.dispose();
  }
}
