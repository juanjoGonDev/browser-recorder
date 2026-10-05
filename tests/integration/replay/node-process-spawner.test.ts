import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  SpawnedProcess,
  SpawnRequest,
} from '../../../src/replay/application/ports/process-spawner.ts';
import { nodeProcessSpawner } from '../../../src/replay/adapters/node-process-spawner.ts';

const WAIT_MS = 10_000;

let dir = '';
const running: SpawnedProcess[] = [];

interface Outcome {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number | null;
}

async function script(name: string, source: string): Promise<string> {
  const file = join(dir, name);
  await writeFile(file, source);
  return file;
}

function request(file: string, env: Record<string, string> = {}): SpawnRequest {
  return { command: process.execPath, args: [file], cwd: dir, env };
}

function start(spawnRequest: SpawnRequest): {
  child: SpawnedProcess;
  outcome: Promise<Outcome>;
} {
  const child = nodeProcessSpawner.spawn(spawnRequest);
  running.push(child);
  let stdout = '';
  let stderr = '';
  child.onStdout((chunk) => {
    stdout += chunk;
  });
  child.onStderr((chunk) => {
    stderr += chunk;
  });
  const outcome = new Promise<Outcome>((resolve) => {
    child.onExit((code) => {
      resolve({ stdout, stderr, code });
    });
  });
  return { child, outcome };
}

describe('nodeProcessSpawner', () => {
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'spawner-'));
  });

  afterEach(async () => {
    running.splice(0).forEach((child) => {
      child.kill();
    });
    await rm(dir, { recursive: true, force: true });
  });

  it(
    'captures stdout, stderr and the exit code',
    async () => {
      const file = await script(
        'io.mjs',
        "process.stdout.write('out\\n'); process.stderr.write('err\\n'); process.exit(3);",
      );

      const { outcome } = start(request(file));

      expect(await outcome).toEqual({
        stdout: 'out\n',
        stderr: 'err\n',
        code: 3,
      });
    },
    WAIT_MS,
  );

  it(
    'merges the request environment over the inherited one',
    async () => {
      const file = await script(
        'env.mjs',
        'process.stdout.write(process.env.REPLAY_PROBE + "|" + typeof process.env.PATH);',
      );

      const { outcome } = start(request(file, { REPLAY_PROBE: 'on' }));

      expect((await outcome).stdout).toBe('on|string');
    },
    WAIT_MS,
  );

  it(
    'passes an argument with spaces and shell characters untouched',
    async () => {
      const file = await script(
        'my script $(x) & y.mjs',
        'process.stdout.write("ran");',
      );

      const { outcome } = start(request(file));

      expect((await outcome).stdout).toBe('ran');
    },
    WAIT_MS,
  );

  it(
    'delivers stdin writes to the child',
    async () => {
      const file = await script(
        'stdin.mjs',
        "process.stdin.once('data', (d) => { process.stdout.write('got ' + d.toString().trim()); process.exit(130); });",
      );

      const { child, outcome } = start(request(file));
      child.writeStdin('abort\n');

      expect(await outcome).toMatchObject({ stdout: 'got abort', code: 130 });
    },
    WAIT_MS,
  );

  it(
    'kills a child that never exits and reports a null code',
    async () => {
      const file = await script(
        'hang.mjs',
        'setInterval(() => undefined, 1000);',
      );

      const { child, outcome } = start(request(file));
      child.kill();

      expect((await outcome).code).toBeNull();
    },
    WAIT_MS,
  );

  it(
    'reports a spawn failure as stderr and a null exit code',
    async () => {
      const { outcome } = start({
        command: join(dir, 'no-such-binary'),
        args: [],
        cwd: dir,
        env: {},
      });

      const result = await outcome;

      expect(result.code).toBeNull();
      expect(result.stderr).toContain('no-such-binary');
    },
    WAIT_MS,
  );

  it(
    'tolerates writing to stdin after the child exited',
    async () => {
      const file = await script('quick.mjs', 'process.exit(0);');
      const { child, outcome } = start(request(file));
      await outcome;

      expect(() => {
        child.writeStdin('abort\n');
      }).not.toThrow();
    },
    WAIT_MS,
  );
});
