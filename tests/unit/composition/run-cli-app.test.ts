import { describe, expect, it, vi } from 'vitest';

import { runCliApp } from '../../../src/composition/run-cli-app.ts';
import {
  createFakeOutput,
  createFakeServices,
  createFakeSignals,
  createFakeRun,
  stepView,
} from '../../support/cli-fakes.ts';

function setup(nodeVersion = '22.13.0') {
  const output = createFakeOutput();
  const signals = createFakeSignals();
  const run = createFakeRun([]);
  const createServices = vi.fn(() =>
    createFakeServices([{ slug: 'demo', name: 'Demo' }], () =>
      Promise.resolve(run),
    ),
  );
  const version = vi.fn(() => '1.2.3');
  const exec = (argv: string[]) =>
    runCliApp(argv, { nodeVersion, output, signals, version, createServices });
  return { output, run, createServices, version, exec };
}

describe('src/composition/run-cli-app.ts', () => {
  it('prints the version without creating services', async () => {
    const { output, createServices, exec } = setup();
    expect(await exec(['--version'])).toBe(0);
    expect(output.stdout()).toBe('1.2.3\n');
    expect(createServices).not.toHaveBeenCalled();
  });

  it('prints the usage for --help and -h', async () => {
    for (const flag of ['--help', '-h']) {
      const { output, createServices, version, exec } = setup();
      expect(await exec([flag])).toBe(0);
      expect(output.stdout()).toContain('replay <name|slug>');
      expect(createServices).not.toHaveBeenCalled();
      expect(version).not.toHaveBeenCalled();
    }
  });

  it('exits 2 with usage on stderr for an unknown subcommand and an unknown flag', async () => {
    const unknown = setup();
    expect(await unknown.exec(['foo'])).toBe(2);
    expect(unknown.output.stderr()).toContain('Unknown command "foo".');
    const flag = setup();
    expect(await flag.exec(['replay', 'demo', '--nope'])).toBe(2);
    expect(flag.output.stderr()).toContain('--nope');
    expect(flag.createServices).not.toHaveBeenCalled();
  });

  it('exits 2 for a missing recording name and a missing -d value', async () => {
    const noName = setup();
    expect(await noName.exec(['replay'])).toBe(2);
    expect(noName.output.stderr()).toContain('Missing argument');
    const noValue = setup();
    expect(await noValue.exec(['replay', 'demo', '-d'])).toBe(2);
    expect(noValue.output.stderr()).toContain('--delay');
  });

  it.each(['abc', '1.5-3', '900-250', '0-60001', '500'])(
    'exits 2 for the delay %s before anything is spawned',
    async (range) => {
      const { createServices, exec } = setup();
      expect(await exec(['replay', 'demo', '-d', range])).toBe(2);
      expect(createServices).not.toHaveBeenCalled();
    },
  );

  it('replays through the services and exits 0', async () => {
    const { output, run, exec } = setup();
    const done = exec(['replay', 'demo', '-r']);
    await new Promise((resolve) => setTimeout(resolve, 5));
    run.finish({ ...stepView([]), status: 'succeeded' });
    run.release();
    expect(await done).toBe(0);
    expect(output.stdout()).toContain('✔ Demo replayed');
  });

  it('refuses an old Node before parsing anything', async () => {
    const { output, createServices, exec } = setup('18.0.0');
    expect(await exec(['--version'])).toBe(1);
    expect(output.stderr()).toMatch(/Node\.js .* or newer; found 18\.0\.0/u);
    expect(createServices).not.toHaveBeenCalled();
    expect(output.flushCount()).toBe(1);
  });
});
