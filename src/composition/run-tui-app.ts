import { assertSupportedNode } from '../environment-setup/domain/assert-supported-node.ts';
import { isColorEnabled } from '../shared/domain/terminal-text.ts';
import {
  createNodeTerminal,
  interactiveTerminalProblem,
  type InputStream,
  type OutputStream,
  type ProcessLike,
} from '../tui/adapters/node-terminal.ts';
import { createNodeTimers } from '../tui/adapters/node-timers.ts';
import type { TuiSessionDeps } from '../tui/application/tui-session.ts';
import { createFrameRenderer } from '../tui/render/render-frame.ts';
import type { ComposedServices } from './create-app-services.ts';
import { exitAfterSaving } from './exit-after-saving.ts';

const EXIT_FAILURE = 1;
const EXIT_OK = 0;
/** A recording gets this long to be saved when the process is cut short. */
const SAVE_DEADLINE_MS = 5000;

export interface TuiAppDeps {
  /** `process.versions.node`. */
  readonly nodeVersion: string;
  readonly input: InputStream;
  readonly output: OutputStream;
  readonly process: ProcessLike;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Called only once the terminal and Node were accepted. */
  readonly createServices: () => ComposedServices;
  /** `runTui`; injected so the wiring is testable without a screen. */
  readonly runSession: (deps: TuiSessionDeps) => Promise<void>;
}

/** The checks that need no browser and no files: exit before any setup. */
function startupProblem(deps: TuiAppDeps): string | null {
  try {
    assertSupportedNode(deps.nodeVersion);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return interactiveTerminalProblem({
    input: deps.input,
    output: deps.output,
  });
}

/** Opens the interactive recorder and returns the exit code when it quits. */
export async function runTuiApp(deps: TuiAppDeps): Promise<number> {
  const problem = startupProblem(deps);
  if (problem !== null) {
    deps.process.stderr.write(`${problem}\n`);
    return EXIT_FAILURE;
  }
  const services = deps.createServices();
  const leave = exitAfterSaving({
    persist: () => services.persistActiveRecording(),
    exit: (code) => deps.process.exit(code),
    deadlineMs: SAVE_DEADLINE_MS,
  });
  await deps.runSession({
    services,
    terminal: createNodeTerminal({
      input: deps.input,
      output: deps.output,
      // Ctrl+C from outside, SIGTERM or a crash save the recording first.
      process: {
        on: (event, listener) => deps.process.on(event, listener),
        off: (event, listener) => deps.process.off(event, listener),
        stderr: deps.process.stderr,
        exit: leave,
      },
    }),
    timers: createNodeTimers(),
    renderFrame: createFrameRenderer(isColorEnabled(deps.env)),
  });
  return EXIT_OK;
}
