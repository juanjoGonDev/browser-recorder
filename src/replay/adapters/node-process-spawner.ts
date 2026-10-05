import { spawn } from 'node:child_process';

import type {
  ProcessSpawner,
  SpawnedProcess,
  SpawnRequest,
} from '../application/ports/process-spawner.ts';

function toSpawnedProcess(child: ReturnType<typeof spawn>): SpawnedProcess {
  // A child that already exited makes stdin emit EPIPE; that is not an error
  // for a best-effort abort request.
  child.stdin?.on('error', () => undefined);
  return {
    onStdout(listener) {
      child.stdout?.setEncoding('utf8').on('data', listener);
    },
    onStderr(listener) {
      child.stderr?.setEncoding('utf8').on('data', listener);
    },
    onExit(listener) {
      // Both `close` and `error` can fire for one failed start: report once.
      let isReported = false;
      const report = (code: number | null): void => {
        if (isReported) return;
        isReported = true;
        listener(code);
      };
      // `close` fires after the output streams ended, so no line is lost.
      child.once('close', report);
      child.once('error', (error) => {
        child.stderr?.emit('data', `${error.message}\n`);
        report(null);
      });
    },
    writeStdin(text) {
      if (child.stdin?.writable === true) child.stdin.write(text);
    },
    kill() {
      child.kill();
    },
  };
}

/** Starts a child with an argument array, never through a shell. */
export const nodeProcessSpawner: ProcessSpawner = {
  spawn(request: SpawnRequest): SpawnedProcess {
    const child = spawn(request.command, [...request.args], {
      cwd: request.cwd,
      env: { ...process.env, ...request.env },
      shell: false,
      stdio: 'pipe',
    });
    return toSpawnedProcess(child);
  },
};
