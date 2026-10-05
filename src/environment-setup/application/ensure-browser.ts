import { linuxDepsGuidance } from '../domain/linux-deps-hint.ts';
import type { BrowserInstallation } from './ports/browser-installation.ts';

export type EnsureBrowserEvent =
  | { readonly kind: 'missing' }
  | { readonly kind: 'install-output'; readonly line: string };

export type EnsureBrowserResult =
  | { readonly kind: 'ready'; readonly linuxHint: string | null }
  | { readonly kind: 'failed'; readonly manualCommand: string };

export interface EnsureBrowserDeps {
  readonly installation: BrowserInstallation;
  /** `process.platform` value, injected so the hint is testable. */
  readonly platform: string;
  readonly onEvent: (event: EnsureBrowserEvent) => void;
}

export const MANUAL_INSTALL_COMMAND = 'pnpm exec playwright install chromium';

const FAILED: EnsureBrowserResult = {
  kind: 'failed',
  manualCommand: MANUAL_INSTALL_COMMAND,
};

async function installAndRecheck(
  deps: EnsureBrowserDeps,
): Promise<EnsureBrowserResult> {
  const { installation, onEvent } = deps;
  onEvent({ kind: 'missing' });
  try {
    const { exitCode } = await installation.install((line) => {
      onEvent({ kind: 'install-output', line });
    });
    if (exitCode !== 0) return FAILED;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    onEvent({ kind: 'install-output', line: reason });
    return FAILED;
  }
  return (await installation.isInstalled()) ? ready(deps) : FAILED;
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
