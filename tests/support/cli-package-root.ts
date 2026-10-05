import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildApp } from '../../scripts/build.ts';
import type { Recording } from '../../src/shared/domain/recording.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BUILD_TIMEOUT_MS = 120_000;
const KILL_AFTER_MS = 60_000;

export interface CliRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RunningCli {
  readonly child: ChildProcess;
  /** Resolves once stdout contains `text`; rejects if the process ends first. */
  waitForOutput(text: string): Promise<void>;
  readonly result: Promise<CliRun>;
}

export interface TempPackageRoot {
  readonly root: string;
  writeRecording(recording: Recording): void;
  start(args: readonly string[], env?: Record<string, string>): RunningCli;
  run(args: readonly string[], env?: Record<string, string>): Promise<CliRun>;
  dispose(): void;
}

/**
 * A package root in the temporary folder: a fresh build of the app, the real
 * dependencies linked in, and its own `recordings` folder. Nothing in the
 * repository's `recordings` folder is read or written.
 */
export async function createTempPackageRoot(): Promise<TempPackageRoot> {
  const root = mkdtempSync(path.join(tmpdir(), 'br-cli-root-'));
  cpSync(path.join(ROOT, 'package.json'), path.join(root, 'package.json'));
  symlinkSync(
    path.join(ROOT, 'node_modules'),
    path.join(root, 'node_modules'),
    'junction',
  );
  await buildApp({ root: ROOT, outDir: path.join(root, 'dist') });
  const entry = path.join(root, 'dist', 'main.js');

  const start = (
    args: readonly string[],
    env: Record<string, string> = {},
  ): RunningCli => {
    const child = spawn(process.execPath, [entry, ...args], {
      cwd: root,
      env: { ...process.env, BROWSER_RECORDER_HEADLESS: '1', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return observe(child);
  };

  return {
    root,
    writeRecording(recording) {
      const folder = path.join(root, 'recordings', recording.slug);
      mkdirSync(folder, { recursive: true });
      writeFileSync(
        path.join(folder, 'recording.json'),
        JSON.stringify(recording),
      );
    },
    start,
    run: (args, env) => start(args, env).result,
    dispose() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function observe(child: ChildProcess): RunningCli {
  let stdout = '';
  let stderr = '';
  const watchers: { text: string; resolve: () => void }[] = [];
  const killer = setTimeout(() => child.kill('SIGKILL'), KILL_AFTER_MS);
  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
    for (const watcher of watchers.splice(0)) {
      if (stdout.includes(watcher.text)) watcher.resolve();
      else watchers.push(watcher);
    }
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const result = new Promise<CliRun>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      clearTimeout(killer);
      resolve({ code, stdout, stderr });
    });
  });
  return {
    child,
    result,
    waitForOutput: (text) =>
      new Promise((resolve, reject) => {
        if (stdout.includes(text)) {
          resolve();
          return;
        }
        watchers.push({ text, resolve });
        void result.then(() => {
          reject(new Error(`the command ended before printing "${text}"`));
        });
      }),
  };
}

export { BUILD_TIMEOUT_MS };
