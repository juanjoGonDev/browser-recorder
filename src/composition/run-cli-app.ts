import { tokenizeArgv } from '../cli/adapters/tokenize-argv.ts';
import type { CommandOutput } from '../cli/application/ports/command-output.ts';
import type { InterruptSignals } from '../cli/application/ports/interrupt-signals.ts';
import type { ReplayCommandServices } from '../cli/application/ports/replay-command-services.ts';
import { runCli } from '../cli/application/run-cli.ts';
import { assertSupportedNode } from '../environment-setup/domain/assert-supported-node.ts';

const EXIT_FAILURE = 1;

export interface CliAppDeps {
  /** `process.versions.node`. */
  readonly nodeVersion: string;
  readonly output: CommandOutput;
  readonly signals: InterruptSignals;
  /** Read only when `--version` asks for it. */
  readonly version: () => string;
  /** Called only for a replay: help and version need no browser paths. */
  readonly createServices: () => ReplayCommandServices;
}

async function refuseOldNode(
  deps: CliAppDeps,
  error: unknown,
): Promise<number> {
  const message = error instanceof Error ? error.message : String(error);
  deps.output.err(`${message}\n`);
  await deps.output.flush();
  return EXIT_FAILURE;
}

/** Runs one command line and returns the process exit code. */
export async function runCliApp(
  argv: readonly string[],
  deps: CliAppDeps,
): Promise<number> {
  try {
    assertSupportedNode(deps.nodeVersion);
  } catch (error) {
    return refuseOldNode(deps, error);
  }
  return runCli(argv, {
    tokenizer: { tokenize: tokenizeArgv },
    output: deps.output,
    signals: deps.signals,
    // A getter keeps `--help` and `--version` apart: only the latter reads it.
    get version() {
      return deps.version();
    },
    createServices: deps.createServices,
  });
}
