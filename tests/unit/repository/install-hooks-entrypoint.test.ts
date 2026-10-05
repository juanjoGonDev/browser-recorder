import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'scripts',
  'install-hooks.ts',
);

describe('scripts/install-hooks.ts as the process entrypoint', () => {
  const originalArgv1 = process.argv[1];
  const originalSkip = process.env['SKIP_GIT_HOOKS'];
  const originalExitCode = process.exitCode;

  afterEach(() => {
    process.argv[1] = originalArgv1;
    if (originalSkip === undefined) delete process.env['SKIP_GIT_HOOKS'];
    else process.env['SKIP_GIT_HOOKS'] = originalSkip;
    process.exitCode = originalExitCode;
  });

  it('runs installHooks on its own and leaves the exit code alone when it skips', async () => {
    process.argv[1] = SCRIPT;
    process.env['SKIP_GIT_HOOKS'] = 'true';

    await import(`${pathToFileURL(SCRIPT).href}?as-entrypoint`);

    expect(process.exitCode).toBe(originalExitCode);
  });

  it('does nothing when another module is the entrypoint', async () => {
    process.argv[1] = path.join(path.dirname(SCRIPT), 'build.ts');
    // Without SKIP_GIT_HOOKS a stray run would call `lefthook install`; the
    // import must not execute anything, so this stays safe in a git checkout.
    delete process.env['SKIP_GIT_HOOKS'];

    await import(`${pathToFileURL(SCRIPT).href}?not-entrypoint`);

    expect(process.exitCode).toBe(originalExitCode);
  });
});
