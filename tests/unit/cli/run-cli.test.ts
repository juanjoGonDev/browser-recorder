import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/application/run-cli.ts';
import { usageText } from '../../../src/cli/domain/usage-text.ts';
import {
  createFakeOutput,
  createFakeRun,
  createFakeServices,
  createFakeSignals,
  createFakeTokenizer,
  stepView,
} from '../../support/cli-fakes.ts';

const NO_FLAGS = {
  isRandom: false,
  delay: null,
  isHeadless: false,
  isHelp: false,
  isVersion: false,
} as const;

function setup(
  result: Parameters<typeof createFakeTokenizer>[0],
  createServices?: () => ReturnType<typeof createFakeServices>,
) {
  const tokenizer = createFakeTokenizer(result);
  const output = createFakeOutput();
  const signals = createFakeSignals();
  let created = 0;
  const run = createFakeRun([]);
  const fallback = () =>
    createFakeServices([{ slug: 'demo', name: 'Demo' }], () =>
      Promise.resolve(run),
    );
  const exec = (argv: string[]) =>
    runCli(argv, {
      tokenizer,
      output,
      signals,
      version: '9.9.9',
      createServices: () => {
        created += 1;
        return (createServices ?? fallback)();
      },
    });
  return { tokenizer, output, run, exec, createdCount: () => created };
}

describe('src/cli/application/run-cli.ts', () => {
  it.each([
    [{ ...NO_FLAGS, isHelp: true }, ['--help']],
    [{ ...NO_FLAGS, isHelp: true }, ['-h']],
  ])(
    'prints the usage on stdout and exits 0 without services (%j)',
    async (flags, argv) => {
      const { output, exec, createdCount } = setup({
        kind: 'parsed',
        positionals: [],
        flags,
      });
      expect(await exec(argv)).toBe(0);
      expect(output.stdout()).toBe(usageText());
      expect(output.stderr()).toBe('');
      expect(createdCount()).toBe(0);
    },
  );

  it('prints the version on stdout and exits 0 without services', async () => {
    const { output, exec, createdCount } = setup({
      kind: 'parsed',
      positionals: [],
      flags: { ...NO_FLAGS, isVersion: true },
    });
    expect(await exec(['-v'])).toBe(0);
    expect(output.stdout()).toBe('9.9.9\n');
    expect(createdCount()).toBe(0);
  });

  it('prints the reason and the usage on stderr and exits 2 for an unknown subcommand', async () => {
    const { output, exec, createdCount } = setup({
      kind: 'parsed',
      positionals: ['foo'],
      flags: NO_FLAGS,
    });
    expect(await exec(['foo'])).toBe(2);
    expect(output.stderr()).toBe(`Unknown command "foo".\n\n${usageText()}`);
    expect(output.stdout()).toBe('');
    expect(createdCount()).toBe(0);
  });

  it('names a refused option and spawns nothing', async () => {
    const { output, exec, createdCount } = setup({
      kind: 'rejected',
      message: 'Unknown option "--nope".',
    });
    expect(await exec(['replay', 'demo', '--nope'])).toBe(2);
    expect(output.stderr()).toContain('--nope');
    expect(createdCount()).toBe(0);
  });

  it('hands argv to the tokenizer untouched', async () => {
    const { tokenizer, exec } = setup({
      kind: 'rejected',
      message: 'x',
    });
    await exec(['replay', 'My Flow', '-d', '1-2']);
    expect(tokenizer.calls).toStrictEqual([['replay', 'My Flow', '-d', '1-2']]);
  });

  it('creates the services only for a replay and runs it', async () => {
    const { output, run, exec, createdCount } = setup({
      kind: 'parsed',
      positionals: ['replay', 'demo'],
      flags: NO_FLAGS,
    });
    const done = exec(['replay', 'demo']);
    await new Promise((resolve) => setTimeout(resolve, 5));
    run.finish({ ...stepView([]), status: 'succeeded' });
    run.release();
    expect(await done).toBe(0);
    expect(createdCount()).toBe(1);
    expect(output.stdout()).toBe('✔ Demo replayed in 0.0s\n');
    expect(output.flushCount()).toBe(1);
  });

  it('reports an unexpected failure and exits 1', async () => {
    const { output, exec } = setup(
      { kind: 'parsed', positionals: ['replay', 'demo'], flags: NO_FLAGS },
      () => {
        throw new Error('cannot find the package root');
      },
    );
    expect(await exec(['replay', 'demo'])).toBe(1);
    expect(output.stderr()).toBe('✖ cannot find the package root\n');
    expect(output.flushCount()).toBe(1);
  });
});
