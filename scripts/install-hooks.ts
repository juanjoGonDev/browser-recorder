import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isEntrypoint } from './lib/script-runtime.ts';

/**
 * `prepare` — hand the repository's git hooks to lefthook.
 *
 * Preparation runs for the repository and before packing, but can also run in
 * CI or direct local installs where hooks make no sense. The guards keep
 * those cases a successful no-op, and the registry tarball does not ship this
 * repository-only script as a consumer postinstall.
 */

/** The only part of a spawnSync result this script reads. */
export interface HookRunResult {
  status: number | null;
}

export interface HookRunOptions {
  stdio: 'ignore' | 'inherit';
  shell: boolean;
}

export interface InstallHooksDeps {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  /** Does this path exist? Used to detect a real git checkout. */
  exists: (target: string) => boolean;
  run: (
    command: string,
    args: string[],
    options: HookRunOptions,
  ) => HookRunResult;
}

/**
 * Install the hooks. Returns the exit code the caller should adopt, or
 * `null` when there was nothing to do — a skip and a missing git are both
 * a normal, successful no-op, not a failed install.
 */
export function installHooks(deps: InstallHooksDeps): number | null {
  const { env, platform, exists, run } = deps;
  // The installs that must NOT get hooks, one condition per reason: an
  // explicit opt-out, a CI checkout, a production install, and a consumer
  // who unpacked the tarball and has no git repository at all.
  if (env.SKIP_GIT_HOOKS === 'true') return null;
  if (env.CI === 'true') return null;
  if (env.NODE_ENV === 'production') return null;
  if (!exists('.git')) return null;

  // `shell: true` on Windows is what finds git.cmd / lefthook.cmd; on POSIX
  // it would only add a shell between us and the binary.
  const shell = platform === 'win32';
  if (run('git', ['--version'], { stdio: 'ignore', shell }).status !== 0)
    return null;

  // A child killed by a signal reports a null status: that is a failure to
  // install the hooks, not a success.
  return run('lefthook', ['install'], { stdio: 'inherit', shell }).status ?? 1;
}

// Direct execution: node --experimental-strip-types scripts/install-hooks.ts
if (isEntrypoint(import.meta.url)) {
  const code = installHooks({
    env: process.env,
    platform: process.platform,
    exists: existsSync,
    run: (command, args, options) => spawnSync(command, args, options),
  });
  if (code !== null) process.exitCode = code;
}
