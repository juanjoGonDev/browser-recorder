import { exitCodeFor } from '../domain/exit-code.ts';
import {
  interpretArguments,
  type CliCommand,
} from '../domain/interpret-arguments.ts';
import { usageText } from '../domain/usage-text.ts';
import type { ArgumentTokenizer } from './ports/argument-tokenizer.ts';
import type { CommandOutput } from './ports/command-output.ts';
import type { InterruptSignals } from './ports/interrupt-signals.ts';
import type { ReplayCommandServices } from './ports/replay-command-services.ts';
import { runReplayCommand } from './run-replay-command.ts';

export interface CliDeps {
  readonly tokenizer: ArgumentTokenizer;
  readonly output: CommandOutput;
  readonly signals: InterruptSignals;
  readonly version: string;
  /** Called only for a replay: help and version need no browser paths. */
  readonly createServices: () => ReplayCommandServices;
}

async function execute(command: CliCommand, deps: CliDeps): Promise<number> {
  switch (command.kind) {
    case 'help':
      deps.output.out(usageText());
      return exitCodeFor({ kind: 'success' });
    case 'version':
      deps.output.out(`${deps.version}\n`);
      return exitCodeFor({ kind: 'success' });
    case 'usage-error':
      deps.output.err(`${command.message}\n\n${usageText()}`);
      return exitCodeFor({ kind: 'usage' });
    case 'replay':
      return runReplayCommand(command, {
        services: deps.createServices(),
        output: deps.output,
        signals: deps.signals,
      });
  }
}

/** Runs the command line and returns the process exit code. */
export async function runCli(
  argv: readonly string[],
  deps: CliDeps,
): Promise<number> {
  const command = interpretArguments(deps.tokenizer.tokenize(argv));
  let exitCode: number;
  try {
    exitCode = await execute(command, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.output.err(`✖ ${message}\n`);
    exitCode = exitCodeFor({ kind: 'failure' });
  }
  await deps.output.flush();
  return exitCode;
}
