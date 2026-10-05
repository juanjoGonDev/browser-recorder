import { isColorEnabled } from '../../shared/domain/terminal-text.ts';
import type { CommandOutput } from '../application/ports/command-output.ts';

export interface OutputStream {
  readonly isTTY?: boolean | undefined;
  write(text: string, callback?: (error?: Error | null) => void): unknown;
  on(event: 'error', listener: (error: NodeJS.ErrnoException) => void): unknown;
}

export interface StreamOutputDeps {
  readonly stdout: OutputStream;
  readonly stderr: OutputStream;
  readonly env: Readonly<Record<string, string | undefined>>;
}

/** The reader left (`| head`) or the stream is already closed. */
const IGNORED_ERRORS = new Set(['EPIPE', 'ERR_STREAM_DESTROYED']);

function guard(stream: OutputStream): void {
  stream.on('error', (error) => {
    if (!IGNORED_ERRORS.has(error.code ?? '')) throw error;
  });
}

function drain(stream: OutputStream): Promise<void> {
  return new Promise((resolve) => {
    stream.write('', () => {
      resolve();
    });
  });
}

/**
 * Writes to the process streams. A closed pipe is not a failure of the
 * replay, and `flush` lets the caller leave without losing piped output.
 */
export function createStreamOutput(deps: StreamOutputDeps): CommandOutput {
  const { stdout, stderr, env } = deps;
  guard(stdout);
  guard(stderr);
  // One decision for both streams: color only when stdout is a terminal.
  const hasColor = isColorEnabled(env) && stdout.isTTY === true;
  return {
    out: (text) => {
      stdout.write(text);
    },
    err: (text) => {
      stderr.write(text);
    },
    flush: async () => {
      await Promise.all([drain(stdout), drain(stderr)]);
    },
    hasOutColor: hasColor,
    hasErrColor: hasColor && stderr.isTTY === true,
  };
}
