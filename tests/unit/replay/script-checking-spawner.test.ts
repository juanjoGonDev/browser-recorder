import { describe, expect, it, vi } from 'vitest';

import type {
  ProcessSpawner,
  SpawnedProcess,
  SpawnRequest,
} from '../../../src/replay/application/ports/process-spawner.ts';
import { withScriptCheck } from '../../../src/replay/adapters/script-checking-spawner.ts';

const REQUEST: SpawnRequest = {
  command: 'node',
  args: ['/r/recordings/a/script.mjs'],
  cwd: '/r',
  env: {},
};

describe('withScriptCheck', () => {
  it('throws a message naming the file and spawns nothing when it is missing', () => {
    const spawnMock = vi.fn();
    const inner: ProcessSpawner = { spawn: spawnMock };
    const spawner = withScriptCheck(inner, () => false);

    expect(() => spawner.spawn(REQUEST)).toThrow(
      'Replay script not found: /r/recordings/a/script.mjs',
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('delegates when the script exists', () => {
    const child = {} as SpawnedProcess;
    const inner: ProcessSpawner = { spawn: vi.fn(() => child) };
    const exists = vi.fn(() => true);

    const result = withScriptCheck(inner, exists).spawn(REQUEST);

    expect(result).toBe(child);
    expect(exists).toHaveBeenCalledWith('/r/recordings/a/script.mjs');
  });

  it('delegates untouched when there is no script argument', () => {
    const spawnMock = vi.fn();
    const inner: ProcessSpawner = { spawn: spawnMock };

    withScriptCheck(inner, () => false).spawn({ ...REQUEST, args: [] });

    expect(spawnMock).toHaveBeenCalledOnce();
  });
});
