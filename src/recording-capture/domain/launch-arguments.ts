import type { Display } from '../../shared/domain/recording.ts';

/** The engine's own defaults that keep it away from the real keychain. */
const KEYCHAIN_SWITCHES: readonly string[] = [
  '--use-mock-keychain',
  '--password-store=basic',
];

/** The part of a launch target that decides how the browser is started. */
export interface LaunchTargetFacts {
  readonly executablePath: string | null;
  readonly browserArgs: readonly string[];
  readonly shouldUseRealKeychain: boolean;
}

/** What `launchPersistentContext` receives besides the directory and timeout. */
export interface LaunchSettings {
  readonly viewport: { readonly width: number; readonly height: number } | null;
  readonly args: readonly string[];
  readonly ignoreDefaultArgs: readonly string[] | undefined;
  readonly executablePath: string | undefined;
}

/**
 * A real window keeps the browser's own metrics (an emulated viewport makes
 * inner and outer sizes disagree, which pages can see), so only its size is
 * requested. Emulated metrics stay available for recordings made with them.
 */
export function buildLaunchSettings(
  display: Display,
  target: LaunchTargetFacts,
): LaunchSettings {
  const isWindow = display.kind === 'window';
  return {
    viewport: isWindow
      ? null
      : { width: display.width, height: display.height },
    args: [
      ...(isWindow ? [`--window-size=${display.width},${display.height}`] : []),
      ...target.browserArgs,
    ],
    ignoreDefaultArgs: target.shouldUseRealKeychain
      ? KEYCHAIN_SWITCHES
      : undefined,
    executablePath: target.executablePath ?? undefined,
  };
}
