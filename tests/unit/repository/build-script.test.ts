import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BuildDeps } from '../../../scripts/build.ts';
import { buildApp } from '../../../scripts/build.ts';

const directories: string[] = [];

function temporaryRoot(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'br-build-'));
  directories.push(directory);
  return directory;
}

interface Recorder {
  readonly calls: string[];
  readonly deps: BuildDeps;
}

function recordingDeps(failOn?: 'compile'): Recorder {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      compile: (project, outDir) => {
        calls.push(`compile ${project} -> ${outDir}`);
        if (failOn === 'compile') throw new Error('tsc failed');
      },
      bundleInPage: (entry, outfile) => {
        calls.push(`bundle ${entry} -> ${outfile}`);
        return Promise.resolve();
      },
    },
  };
}

describe('scripts/build.ts', () => {
  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('compiles the node project, then bundles the in-page script, into the output directory', async () => {
    const root = temporaryRoot();
    const outDir = path.join(root, 'out');
    const { calls, deps } = recordingDeps();

    await buildApp({ root, outDir }, deps);

    expect(calls).toEqual([
      `compile tsconfig.node.json -> ${outDir}`,
      `bundle ${path.join(root, 'src', 'recording-capture', 'in-page', 'capture-script.ts')} -> ${path.join(outDir, 'in-page', 'capture-script.js')}`,
    ]);
  });

  it('defaults the output directory to dist under the root', async () => {
    const root = temporaryRoot();
    const { calls, deps } = recordingDeps();

    await buildApp({ root }, deps);

    expect(calls[0]).toBe(
      `compile tsconfig.node.json -> ${path.join(root, 'dist')}`,
    );
  });

  it('removes the previous output before compiling', async () => {
    const root = temporaryRoot();
    const outDir = path.join(root, 'out');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'stale.js'), 'old');

    await buildApp({ root, outDir }, recordingDeps().deps);

    expect(existsSync(path.join(outDir, 'stale.js'))).toBe(false);
  });

  it('does not bundle when the compile fails', async () => {
    const root = temporaryRoot();
    const { calls, deps } = recordingDeps('compile');

    await expect(buildApp({ root }, deps)).rejects.toThrow('tsc failed');
    expect(calls).toHaveLength(1);
  });
});
