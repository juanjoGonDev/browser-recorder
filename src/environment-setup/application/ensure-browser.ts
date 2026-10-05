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

// Frozen signature: work package WP5 replaces this declaration with the
// implementation. Present: no install. Missing: announce, install, re-check.
export declare function ensureBrowser(
  deps: EnsureBrowserDeps,
): Promise<EnsureBrowserResult>;
