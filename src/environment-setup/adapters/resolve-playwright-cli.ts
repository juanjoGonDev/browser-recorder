import { dirname, join } from 'node:path';

export interface CliResolverDeps {
  resolve(id: string): string;
  readText(file: string): string;
  exists(file: string): boolean;
}

interface Candidate {
  readonly packageName: string;
  readonly binName: string;
}

// `playwright/cli` is not an exported subpath (Node throws
// ERR_PACKAGE_PATH_NOT_EXPORTED), but `package.json` is, and its `bin` names
// the CLI file. `playwright-core` ships the same CLI as the fallback.
const CANDIDATES: readonly Candidate[] = [
  { packageName: 'playwright', binName: 'playwright' },
  { packageName: 'playwright-core', binName: 'playwright-core' },
];

function readBin(manifest: string, binName: string): string | null {
  const parsed: unknown = JSON.parse(manifest);
  if (typeof parsed !== 'object' || parsed === null) return null;
  const bin = (parsed as { bin?: Record<string, unknown> }).bin;
  const target = bin?.[binName];
  return typeof target === 'string' ? target : null;
}

function tryCandidate(
  deps: CliResolverDeps,
  candidate: Candidate,
): string | null {
  try {
    const manifestPath = deps.resolve(`${candidate.packageName}/package.json`);
    const bin = readBin(deps.readText(manifestPath), candidate.binName);
    if (bin === null) return null;
    const cli = join(dirname(manifestPath), bin);
    return deps.exists(cli) ? cli : null;
  } catch {
    return null;
  }
}

/** Finds the Playwright CLI script to run with `node`, never a `.cmd` shim. */
export function resolvePlaywrightCli(deps: CliResolverDeps): string {
  for (const candidate of CANDIDATES) {
    const cli = tryCandidate(deps, candidate);
    if (cli !== null) return cli;
  }
  throw new Error('Could not locate the Playwright CLI (playwright/cli.js).');
}
