#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { createProcessInterruptSignals } from './cli/adapters/process-interrupt-signals.ts';
import { createStreamOutput } from './cli/adapters/stream-output.ts';
import {
  createProductionReplayCommandServices,
  createProductionServices,
  resolveProductionPaths,
} from './composition/create-production-services.ts';
import { readPackageVersion } from './composition/package-version.ts';
import { runCliApp } from './composition/run-cli-app.ts';
import { runTuiApp } from './composition/run-tui-app.ts';
import { runTui } from './tui/application/tui-session.ts';

const EXIT_FAILURE = 1;
const FIRST_ARGUMENT = 2;

function productionOptions() {
  return {
    paths: resolveProductionPaths(import.meta.url),
    isHeadless: process.env['BROWSER_RECORDER_HEADLESS'] === '1',
  };
}

function runTuiFromProcess(): Promise<number> {
  return runTuiApp({
    nodeVersion: process.versions.node,
    input: process.stdin,
    output: process.stdout,
    process,
    env: process.env,
    createServices: () => createProductionServices(productionOptions()),
    runSession: runTui,
  });
}

function runCliFromProcess(argv: readonly string[]): Promise<number> {
  return runCliApp(argv, {
    nodeVersion: process.versions.node,
    output: createStreamOutput({
      stdout: process.stdout,
      stderr: process.stderr,
      env: process.env,
    }),
    signals: createProcessInterruptSignals({
      source: process,
      platform: process.platform,
    }),
    version: () =>
      readPackageVersion(import.meta.url, {
        readText: (file) => readFileSync(file, 'utf8'),
        exists: existsSync,
      }),
    createServices: () =>
      createProductionReplayCommandServices(productionOptions()),
  });
}

/** No arguments open the interactive recorder; any argument is a command. */
function run(): Promise<number> {
  const argv = process.argv.slice(FIRST_ARGUMENT);
  return argv.length === 0 ? runTuiFromProcess() : runCliFromProcess(argv);
}

const exitCode = await run().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  return EXIT_FAILURE;
});
// Patchright or timers may still hold the event loop: leave on purpose.
process.exit(exitCode);
