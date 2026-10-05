import type {
  ProcessSpawner,
  SpawnRequest,
} from '../application/ports/process-spawner.ts';

/**
 * Refuses to start when the entry script (the first argument) is missing, so
 * the user sees the file name instead of a Node "Cannot find module" crash.
 */
export function withScriptCheck(
  inner: ProcessSpawner,
  scriptExists: (scriptPath: string) => boolean,
): ProcessSpawner {
  return {
    spawn(request: SpawnRequest) {
      const [script] = request.args;
      if (script !== undefined && !scriptExists(script)) {
        throw new Error(`Replay script not found: ${script}`);
      }
      return inner.spawn(request);
    },
  };
}
