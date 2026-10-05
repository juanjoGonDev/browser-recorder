/**
 * Production build: `tsc` for the Node program and esbuild for the in-page
 * capture script, which runs inside Chromium and so cannot be a Node module.
 *
 * tsc runs through node directly (node_modules/typescript/bin/tsc) so no shell
 * or .bin shim resolution is involved: the output is identical on Windows,
 * macOS and Linux. It is handed `cwd: root` rather than the process being
 * chdir'd into it, so the relative `-p tsconfig.node.json` resolves the same
 * way without a build script mutating the cwd of whatever started it.
 *
 * The two expensive steps are injected so the choreography around them (what
 * is wiped, which order they run in) is testable without a real compile.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { isEntrypoint } from './lib/script-runtime.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE_PROJECT = 'tsconfig.node.json';
const IN_PAGE_ENTRY = path.join(
  'src',
  'recording-capture',
  'in-page',
  'capture-script.ts',
);
const IN_PAGE_OUTPUT = path.join('in-page', 'capture-script.js');
const EXECUTABLE_MODE = 0o755;

export interface BuildDeps {
  /** Compile one tsconfig project into `outDir`, resolved against the root. */
  compile: (project: string, outDir: string) => void;
  /** Bundle the in-page entry point into a single classic script. */
  bundleInPage: (entry: string, outfile: string) => Promise<void>;
}

export interface BuildOptions {
  readonly root?: string;
  readonly outDir?: string;
}

/** The real toolchain: the repo's own tsc and esbuild. */
export function defaultBuildDeps(root: string): BuildDeps {
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  return {
    compile: (project, outDir) => {
      execFileSync(process.execPath, [tsc, '-p', project, '--outDir', outDir], {
        stdio: 'inherit',
        cwd: root,
      });
    },
    bundleInPage: bundleInPageWithEsbuild,
  };
}

async function bundleInPageWithEsbuild(
  entry: string,
  outfile: string,
): Promise<void> {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    // A classic script: addInitScript({ path }) evaluates it, so it cannot
    // carry import or export statements.
    format: 'iife',
    platform: 'browser',
    target: 'es2023',
    legalComments: 'none',
    outfile,
  });
}

/** Bundle only the in-page script, for tests that need it without a tsc run. */
export async function bundleInPage(
  root: string = ROOT,
  outDir: string = path.join(root, 'dist'),
): Promise<string> {
  const outfile = path.join(outDir, IN_PAGE_OUTPUT);
  await bundleInPageWithEsbuild(path.join(root, IN_PAGE_ENTRY), outfile);
  return outfile;
}

export async function buildApp(
  options: BuildOptions = {},
  deps?: BuildDeps,
): Promise<void> {
  const root = options.root ?? ROOT;
  const outDir = options.outDir ?? path.join(root, 'dist');
  const steps = deps ?? defaultBuildDeps(root);

  rmSync(outDir, { recursive: true, force: true });
  steps.compile(NODE_PROJECT, outDir);
  await steps.bundleInPage(
    path.join(root, IN_PAGE_ENTRY),
    path.join(outDir, IN_PAGE_OUTPUT),
  );

  // The `bin` entry must be executable on POSIX; Windows has no such bit.
  const main = path.join(outDir, 'main.js');
  if (existsSync(main)) chmodSync(main, EXECUTABLE_MODE);
}

// Direct execution: node --experimental-strip-types scripts/build.ts
if (isEntrypoint(import.meta.url)) {
  buildApp().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
