import { linuxDepsGuidance } from '../domain/linux-deps-hint.ts';
import type { BrowserInstallation } from './ports/browser-installation.ts';

export type EnsureBrowserEvent =
  | { readonly kind: 'missing' }
  | { readonly kind: 'install-output'; readonly line: string };

export type EnsureBrowserResult =
  | { readonly kind: 'ready'; readonly linuxHint: string | null }
  | {
      readonly kind: 'failed';
      readonly manualCommand: string;
      /** The installer's exit code; `null` when it never produced one. */
      readonly exitCode: number | null;
    };

export interface EnsureBrowserDeps {
  readonly installation: BrowserInstallation;
  /** `process.platform` value, injected so the hint is testable. */
  readonly platform: string;
  readonly onEvent: (event: EnsureBrowserEvent) => void;
}

export const MANUAL_INSTALL_COMMAND = 'pnpm exec playwright install chromium';

function failed(exitCode: number | null): EnsureBrowserResult {
  return { kind: 'failed', manualCommand: MANUAL_INSTALL_COMMAND, exitCode };
}

async function installAndRecheck(
  deps: EnsureBrowserDeps,
): Promise<EnsureBrowserResult> {
  const { installation, onEvent } = deps;
  onEvent({ kind: 'missing' });
  let exitCode: number | null;
  try {
    ({ exitCode } = await installation.install((line) => {
      onEvent({ kind: 'install-output', line });
    }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    onEvent({ kind: 'install-output', line: reason });
    return failed(null);
  }
  if (exitCode !== 0) return failed(exitCode);
  return (await installation.isInstalled()) ? ready(deps) : failed(exitCode);
}

function ready(deps: EnsureBrowserDeps): EnsureBrowserResult {
  return { kind: 'ready', linuxHint: linuxDepsGuidance(deps.platform) };
}

/** Present: no install. Missing: announce, install, re-check. */
export async function ensureBrowser(
  deps: EnsureBrowserDeps,
): Promise<EnsureBrowserResult> {
  if (await deps.installation.isInstalled()) return ready(deps);
  return installAndRecheck(deps);
}
