import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface NodeRun {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

export interface NodeRunOptions {
  /** Written to stdin once the child has started. */
  readonly stdin?: string;
  /** Files to create next to the module, by relative path. */
  readonly files?: Readonly<Record<string, string>>;
  /** Close stdin right after `stdin`; by default it stays open. */
  readonly shouldCloseStdin?: boolean;
  /** Extra environment variables. */
  readonly env?: Readonly<Record<string, string>>;
  /** Sends `name` to the child once its stdout shows `afterOutput`. */
  readonly signal?: {
    readonly name: NodeJS.Signals;
    readonly afterOutput: string;
  };
  /** Directory holding the module, for specs that need real node_modules. */
  readonly directory?: string;
}

const KILL_AFTER_MS = 20_000;

function writeFixtureFiles(
  directory: string,
  files: Readonly<Record<string, string>>,
): void {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(directory, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

/** Runs a source string as `node module.mjs` in a scratch directory. */
export async function runNodeModule(
  source: string,
  options: NodeRunOptions = {},
): Promise<NodeRun> {
  const directory =
    options.directory ?? mkdtempSync(path.join(tmpdir(), 'run-node-'));
  try {
    const file = path.join(directory, 'subject.mjs');
    writeFileSync(file, source);
    writeFixtureFiles(directory, options.files ?? {});
    return await execute(file, directory, options);
  } finally {
    if (options.directory === undefined) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
}

function execute(
  file: string,
  directory: string,
  options: NodeRunOptions,
): Promise<NodeRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], {
      cwd: directory,
      env: { ...process.env, ...options.env },
      stdio: 'pipe',
    });
    const killer = setTimeout(() => child.kill('SIGKILL'), KILL_AFTER_MS);
    let stdout = '';
    let stderr = '';
    let wasSignalSent = false;
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      const { signal } = options;
      if (signal && !wasSignalSent && stdout.includes(signal.afterOutput)) {
        wasSignalSent = true;
        child.kill(signal.name);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (exitCode) => {
      clearTimeout(killer);
      resolve({ stdout, stderr, exitCode });
    });
    if (options.stdin !== undefined) {
      child.stdin.write(options.stdin);
    }
    if (options.shouldCloseStdin === true) {
      child.stdin.end();
    }
  });
}
