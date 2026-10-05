import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright';

import type {
  BrowserInstallation,
  InstallResult,
} from '../application/ports/browser-installation.ts';

export interface PlaywrightInstallationOptions {
  /** Playwright CLI script, see `resolvePlaywrightCli`. */
  readonly cliPath: string;
  /** Always `process.execPath` in production: no shell, no `.cmd` shim. */
  readonly nodePath: string;
  readonly executablePath?: () => string;
  readonly exists?: (file: string) => boolean;
}

const INSTALL_ARGV = ['install', 'chromium'] as const;

function streamLines(
  stream: NodeJS.ReadableStream | null,
  onLine: (line: string) => void,
): void {
  if (stream === null) return;
  createInterface({ input: stream }).on('line', onLine);
}

function runInstaller(
  options: PlaywrightInstallationOptions,
  onLine: (line: string) => void,
): Promise<InstallResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.nodePath, [options.cliPath, ...INSTALL_ARGV], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    streamLines(child.stdout, onLine);
    streamLines(child.stderr, onLine);
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({ exitCode });
    });
  });
}

/** Detects Chromium on disk and installs it through the Playwright CLI. */
export function createPlaywrightBrowserInstallation(
  options: PlaywrightInstallationOptions,
): BrowserInstallation {
  const executablePath =
    options.executablePath ?? (() => chromium.executablePath());
  const exists = options.exists ?? existsSync;
  return {
    isInstalled: () => Promise.resolve(exists(executablePath())),
    install: (onLine) => runInstaller(options, onLine),
  };
}
