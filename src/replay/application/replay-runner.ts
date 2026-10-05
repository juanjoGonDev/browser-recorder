import { parseProgressLine } from '../domain/parse-progress-line.ts';
import {
  applyExit,
  applyMessage,
  applyStderrLine,
  createReplayProgress,
  type ReplayProgress,
} from '../domain/replay-progress.ts';
import { createLineSplitter } from '../domain/split-lines.ts';
import type {
  ProcessSpawner,
  SpawnedProcess,
} from './ports/process-spawner.ts';

export interface LiveReplay {
  subscribe(listener: (progress: ReplayProgress) => void): () => void;
  cancel(): Promise<void>;
  readonly finished: Promise<ReplayProgress>;
}

export interface StartReplayDeps {
  readonly spawner: ProcessSpawner;
  readonly nodePath: string;
  readonly cancelGraceMs: number;
}

export interface StartReplayRequest {
  readonly scriptPath: string;
  readonly cwd: string;
  readonly isHeadless: boolean;
  /** Browser settings for the script, merged over the inherited environment. */
  readonly launchEnv: Readonly<Record<string, string>>;
  /** Recorded offset of every step, in order: drift is `elapsed - offset`. */
  readonly stepOffsetsMs: readonly number[];
}

const HEADLESS_ENV = 'BROWSER_RECORDER_HEADLESS';
const ABORT_LINE = 'abort\n';

/** The headless flag comes last so the launch environment cannot undo it. */
function spawnEnvironment(request: StartReplayRequest): Record<string, string> {
  return {
    ...request.launchEnv,
    ...(request.isHeadless ? { [HEADLESS_ENV]: '1' } : {}),
  };
}

function failedBeforeStart(
  request: StartReplayRequest,
  reason: unknown,
): LiveReplay {
  const message = reason instanceof Error ? reason.message : String(reason);
  const progress: ReplayProgress = {
    ...applyExit(createReplayProgress(request.stepOffsetsMs), null, false),
    errorMessage: message,
  };
  return {
    subscribe: () => () => undefined,
    cancel: () => Promise.resolve(),
    finished: Promise.resolve(progress),
  };
}

/** Replays a script by spawning it and folding its output into progress. */
export function startReplay(
  deps: StartReplayDeps,
  request: StartReplayRequest,
): LiveReplay {
  let child: SpawnedProcess;
  try {
    child = deps.spawner.spawn({
      command: deps.nodePath,
      args: [request.scriptPath],
      cwd: request.cwd,
      env: spawnEnvironment(request),
    });
  } catch (error) {
    return failedBeforeStart(request, error);
  }
  return new ReplayObserver(child, deps.cancelGraceMs, request.stepOffsetsMs);
}

/** Tracks one running child: progress snapshots, listeners and cancel. */
class ReplayObserver implements LiveReplay {
  readonly finished: Promise<ReplayProgress>;
  private readonly child: SpawnedProcess;
  private readonly cancelGraceMs: number;
  private progress: ReplayProgress;
  private isCancelRequested = false;
  private isExited = false;
  private readonly listeners = new Set<(progress: ReplayProgress) => void>();
  private readonly stdoutLines = createLineSplitter();
  private readonly stderrLines = createLineSplitter();

  constructor(
    child: SpawnedProcess,
    cancelGraceMs: number,
    stepOffsetsMs: readonly number[],
  ) {
    this.child = child;
    this.cancelGraceMs = cancelGraceMs;
    this.progress = createReplayProgress(stepOffsetsMs);
    child.onStdout((chunk) => {
      this.stdoutLines.push(chunk).forEach(this.onStdoutLine);
    });
    child.onStderr((chunk) => {
      this.stderrLines.push(chunk).forEach(this.onStderrLine);
    });
    this.finished = new Promise((resolve) => {
      child.onExit((code) => {
        resolve(this.settle(code));
      });
    });
  }

  subscribe = (listener: (progress: ReplayProgress) => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  cancel = async (): Promise<void> => {
    if (this.isExited) return;
    this.isCancelRequested = true;
    this.child.writeStdin(ABORT_LINE);
    const killer = setTimeout(() => {
      this.child.kill();
    }, this.cancelGraceMs);
    await this.finished.finally(() => {
      clearTimeout(killer);
    });
  };

  private readonly onStdoutLine = (line: string): void => {
    this.update(applyMessage(this.progress, parseProgressLine(line)));
  };

  private readonly onStderrLine = (line: string): void => {
    this.update(applyStderrLine(this.progress, line));
  };

  private settle(code: number | null): ReplayProgress {
    this.isExited = true;
    this.stdoutLines.flush().forEach(this.onStdoutLine);
    this.stderrLines.flush().forEach(this.onStderrLine);
    this.update(applyExit(this.progress, code, this.isCancelRequested));
    return this.progress;
  }

  private update(next: ReplayProgress): void {
    this.progress = next;
    this.listeners.forEach((listener) => {
      listener(next);
    });
  }
}
