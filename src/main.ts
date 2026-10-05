#!/usr/bin/env node
import {
  createProductionServices,
  resolveProductionPaths,
} from './composition/create-production-services.ts';
import { exitAfterSaving } from './composition/exit-after-saving.ts';
import { assertSupportedNode } from './environment-setup/domain/assert-supported-node.ts';
import { runTui } from './tui/application/tui-session.ts';
import {
  createNodeTerminal,
  interactiveTerminalProblem,
} from './tui/adapters/node-terminal.ts';
import { createNodeTimers } from './tui/adapters/node-timers.ts';
import { createFrameRenderer } from './tui/render/render-frame.ts';
import { isColorEnabled } from './shared/domain/terminal-text.ts';

const EXIT_FAILURE = 1;
const EXIT_OK = 0;
/** A recording gets this long to be saved when the process is cut short. */
const SAVE_DEADLINE_MS = 5000;

function fail(message: string): number {
  process.stderr.write(`${message}\n`);
  return EXIT_FAILURE;
}

/** The checks that need no browser and no files: exit before any setup. */
function startupProblem(): string | null {
  try {
    assertSupportedNode(process.versions.node);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return interactiveTerminalProblem({
    input: process.stdin,
    output: process.stdout,
  });
}

async function run(): Promise<number> {
  const problem = startupProblem();
  if (problem !== null) return fail(problem);
  const services = createProductionServices({
    paths: resolveProductionPaths(import.meta.url),
    isHeadless: process.env['BROWSER_RECORDER_HEADLESS'] === '1',
  });
  const leave = exitAfterSaving({
    persist: () => services.persistActiveRecording(),
    exit: (code) => process.exit(code),
    deadlineMs: SAVE_DEADLINE_MS,
  });
  await runTui({
    services,
    terminal: createNodeTerminal({
      input: process.stdin,
      output: process.stdout,
      // Ctrl+C from outside, SIGTERM or a crash save the recording first.
      process: {
        on: (event, listener) => process.on(event, listener),
        off: (event, listener) => process.off(event, listener),
        stderr: process.stderr,
        exit: leave,
      },
    }),
    timers: createNodeTimers(),
    renderFrame: createFrameRenderer(isColorEnabled(process.env)),
  });
  return EXIT_OK;
}

const exitCode = await run().catch((error: unknown) =>
  fail(error instanceof Error ? error.message : String(error)),
);
// Patchright or timers may still hold the event loop: leave on purpose.
process.exit(exitCode);
