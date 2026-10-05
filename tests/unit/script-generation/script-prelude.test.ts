import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scriptPrelude } from '../../../src/script-generation/domain/script-prelude.ts';
import { runNodeModule } from '../../support/run-node-module.ts';
import type { NodeRunOptions } from '../../support/run-node-module.ts';

const HUMAN_ENV = {
  BROWSER_RECORDER_TIMING: 'human',
  BROWSER_RECORDER_HUMAN_DELAY: '50-100',
  BROWSER_RECORDER_SEED: '7',
};

const FAKES = String.raw`
import { EventEmitter } from 'node:events';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const context = new EventEmitter();
const fakePage = () => new EventEmitter();
`;

function program(body: string): string {
  return `${scriptPrelude}\n${FAKES}\nconst rt = createRuntime(context, { nextPageTimeoutMs: 300, fileChooserTimeoutMs: 300 });\n${body}\n`;
}

function run(body: string, options?: NodeRunOptions) {
  return runNodeModule(program(body), options);
}

function lines(stdout: string): string[] {
  return stdout.split('\n').filter((line) => line !== '');
}

describe('src/script-generation/domain/script-prelude.ts', () => {
  it('prints step, done markers with elapsed milliseconds', async () => {
    const result = await run(`
      rt.start();
      await rt.at(0); rt.mark(0);
      await rt.at(120); rt.mark(1);
      rt.done();`);
    const [first, second, third] = lines(result.stdout);
    expect(first).toMatch(/^::step 0 \d+$/u);
    expect(second).toMatch(/^::step 1 1[2-9]\d$/u);
    expect(third).toMatch(/^::done 1[2-9]\d$/u);
    expect(result.exitCode).toBe(0);
  });

  it('sleeps until the absolute offset, absorbing step duration', async () => {
    const result = await run(`
      rt.start();
      await rt.at(0); rt.mark(0);
      await sleep(150);
      await rt.at(200); rt.mark(1);
      rt.done();`);
    const marker = lines(result.stdout)[1] ?? '';
    const elapsed = Number(marker.split(' ')[2]);
    expect(elapsed).toBeGreaterThanOrEqual(200);
    expect(elapsed).toBeLessThan(260);
  });

  it('never reports a step before its offset even when timers fire early', async () => {
    const result = await run(`
      const realSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = (callback, ms, ...rest) =>
        realSetTimeout(callback, Math.max(0, ms - 2), ...rest);
      rt.start();
      for (const offset of [50, 100, 150, 200]) {
        await rt.at(offset);
        rt.mark(offset);
      }
      rt.done();`);
    const elapsed = lines(result.stdout)
      .filter((line) => line.startsWith('::step '))
      .map((line) => Number(line.split(' ')[2]));
    expect(elapsed).toHaveLength(4);
    elapsed.forEach((value, index) => {
      expect(value).toBeGreaterThanOrEqual([50, 100, 150, 200][index] ?? 0);
    });
  });

  it('runs a late step immediately without extra delay', async () => {
    const result = await run(`
      rt.start();
      await rt.at(0); rt.mark(0);
      await sleep(250);
      const before = performance.now();
      await rt.at(100); rt.mark(1);
      console.log('wait ' + Math.round(performance.now() - before));
      rt.done();`);
    const wait = lines(result.stdout).find((line) => line.startsWith('wait '));
    expect(Number((wait ?? '').split(' ')[1])).toBeLessThan(20);
  });

  it('waits a human delay between actions and ignores recorded offsets', async () => {
    const result = await run(
      `rt.start();
       await rt.at(0); rt.mark(0);
       await rt.at(90000); rt.mark(1);
       await rt.at(90000); rt.mark(2);
       rt.done();`,
      { env: HUMAN_ENV },
    );
    const elapsed = lines(result.stdout)
      .filter((line) => line.startsWith('::step '))
      .map((line) => Number(line.split(' ')[2]));
    expect(elapsed[0]).toBeLessThan(20);
    expect(elapsed[1] - elapsed[0]).toBeGreaterThanOrEqual(40);
    expect(elapsed[2] - elapsed[1]).toBeGreaterThanOrEqual(40);
    expect(elapsed[2]).toBeLessThan(2000);
    expect(result.exitCode).toBe(0);
  });

  it('does not wait before a follow-up step in human mode', async () => {
    const result = await run(
      `rt.start();
       await rt.at(0); rt.mark(0);
       await rt.at(90000, { isFollowUp: true }); rt.mark(1);
       rt.done();`,
      { env: HUMAN_ENV },
    );
    const [, second] = lines(result.stdout);
    expect(Number(second.split(' ')[2])).toBeLessThan(40);
  });

  it('still waits for the recorded offset of a follow-up in recorded mode', async () => {
    const result = await run(
      `rt.start();
       await rt.at(0); rt.mark(0);
       await rt.at(120, { isFollowUp: true }); rt.mark(1);
       rt.done();`,
    );
    const [, second] = lines(result.stdout);
    expect(Number(second.split(' ')[2])).toBeGreaterThanOrEqual(120);
  });

  it('treats an unknown timing mode as recorded', async () => {
    const result = await run(
      `rt.start();
       await rt.at(0); rt.mark(0);
       await rt.at(120); rt.mark(1);
       rt.done();`,
      { env: { ...HUMAN_ENV, BROWSER_RECORDER_TIMING: 'banana' } },
    );
    const [, second] = lines(result.stdout);
    const elapsed = Number(second.split(' ')[2]);
    expect(elapsed).toBeGreaterThanOrEqual(120);
    expect(elapsed).toBeLessThan(250);
  });

  it('draws the same human delays twice for the same seed', async () => {
    const body = `rt.start();
       await rt.at(0); rt.mark(0);
       await rt.at(0); rt.mark(1);
       await rt.at(0); rt.mark(2);
       rt.done();`;
    const gaps = async (): Promise<number[]> => {
      const result = await run(body, { env: HUMAN_ENV });
      const marks = lines(result.stdout)
        .filter((line) => line.startsWith('::step '))
        .map((line) => Number(line.split(' ')[2]));
      return [marks[1] - marks[0], marks[2] - marks[1]];
    };
    const [first, second] = [await gaps(), await gaps()];
    first.forEach((gap, index) => {
      expect(Math.abs(gap - (second[index] ?? 0))).toBeLessThan(30);
    });
    expect(first.every((gap) => gap >= 40 && gap <= 120)).toBe(true);
  });

  it('reports a failure with the current step and exit code 1', async () => {
    const result = await run(`
      rt.start();
      rt.mark(3);
      rt.fail(new Error('boom "quoted"\\nsecond line'));`);
    expect(lines(result.stdout)[1]).toBe(
      '::error 3 "boom \\"quoted\\"\\nsecond line"',
    );
    expect(result.exitCode).toBe(1);
  });

  it('reports a failure before any step with a dash index', async () => {
    const result = await run(`rt.start(); rt.fail('plain text');`);
    expect(lines(result.stdout)).toStrictEqual(['::error - "plain text"']);
  });

  it('exits 130 after running the handler when stdin says abort', async () => {
    const result = await run(
      `rt.start();
       rt.onAbort(async () => { console.log('closed'); });
       await sleep(5000);`,
      { stdin: 'abort\n' },
    );
    expect(result.stdout).toBe('closed\n');
    expect(result.exitCode).toBe(130);
  });

  it('exits 130 when stdin ends', async () => {
    const result = await run(
      `rt.start();
       rt.onAbort(async () => { console.log('closed'); });
       await sleep(5000);`,
      { shouldCloseStdin: true },
    );
    expect(result.exitCode).toBe(130);
  });

  it('ignores other stdin lines', async () => {
    const result = await run(
      `rt.start();
       rt.onAbort(async () => { console.log('closed'); });
       await sleep(200);
       rt.done();`,
      { stdin: 'hello\n' },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('closed');
  });

  it('hands out pages in the order they open, including early ones', async () => {
    const result = await run(`
      rt.start();
      const early = fakePage(); early.name = 'early';
      context.emit('page', early);
      const first = await rt.nextPage();
      setTimeout(() => { const late = fakePage(); late.name = 'late'; context.emit('page', late); }, 50);
      const second = await rt.nextPage();
      console.log(first.name, second.name);
      rt.done();`);
    expect(lines(result.stdout)[0]).toBe('early late');
  });

  it('fails with a clear message when no page opens in time', async () => {
    const result = await run(`
      rt.start();
      try { await rt.nextPage(); } catch (error) { rt.fail(error); }`);
    expect(result.stdout).toMatch(/::error - ".*new tab.*"/u);
    expect(result.exitCode).toBe(1);
  });

  it('answers dialogs in recorded order and dismisses extras', async () => {
    const result = await run(`
      rt.start();
      const page = fakePage();
      rt.expectDialogs(page, [
        { index: 1, action: 'accept', promptText: null },
        { index: 2, action: 'accept', promptText: 'typed' },
        { index: 3, action: 'dismiss', promptText: null },
      ]);
      const answers = [];
      const dialog = (name) => ({
        accept: async (text) => { answers.push(name + ':accept:' + text); },
        dismiss: async () => { answers.push(name + ':dismiss'); },
      });
      for (const name of ['a', 'b', 'c', 'd']) { page.emit('dialog', dialog(name)); }
      await sleep(50);
      console.log(answers.join(','));
      rt.done();`);
    expect(lines(result.stdout)[0]).toBe(
      'a:accept:undefined,b:accept:typed,c:dismiss,d:dismiss',
    );
  });

  it('sets recorded files from the files directory', async () => {
    const result = await run(
      `rt.start();
       const page = fakePage();
       rt.expectFiles(page, [{ index: 4, fileNames: ['report.txt'] }]);
       const chosen = [];
       page.emit('filechooser', { setFiles: async (paths) => { chosen.push(...paths); } });
       await rt.filesSet(4);
       console.log(chosen.map((file) => file.split(/[\\\\/]/u).slice(-2).join('/')).join());
       rt.done();`,
      { files: { 'files/report.txt': 'data' } },
    );
    expect(lines(result.stdout)[0]).toBe('files/report.txt');
  });

  it('fails clearly when a recorded file is missing', async () => {
    const result = await run(`
      rt.start();
      const page = fakePage();
      rt.expectFiles(page, [{ index: 4, fileNames: ['gone.txt'] }]);
      page.emit('filechooser', { setFiles: async () => {} });
      try { await rt.filesSet(4); } catch (error) { rt.fail(error); }`);
    expect(result.stdout).toMatch(/::error - ".*gone\.txt.*"/u);
    expect(result.exitCode).toBe(1);
  });

  it('refuses a recorded file name that leaves the files directory', async () => {
    const result = await run(
      `rt.start();
       const page = fakePage();
       rt.expectFiles(page, [{ index: 4, fileNames: ['../secret.txt'] }]);
       let wasSet = false;
       page.emit('filechooser', { setFiles: async () => { wasSet = true; } });
       try { await rt.filesSet(4); } catch (error) { rt.fail(error); }
       console.log('set ' + wasSet);`,
      { files: { 'secret.txt': 'private' } },
    );
    expect(result.stdout).toMatch(/::error - ".*secret\.txt.*"/u);
    expect(result.stdout).toContain('set false');
  });

  it('times out when the file chooser never opens', async () => {
    const result = await run(`
      rt.start();
      try { await rt.filesSet(9); } catch (error) { rt.fail(error); }`);
    expect(result.stdout).toMatch(/::error - ".*file chooser.*"/iu);
  });
});

const FORBIDDEN_CDP_DOMAINS = ['Runtime', 'Console'];
const TEMP_PROFILE_PREFIX = 'browser-recorder-profile-';
const WINDOW = '{ kind: "window", width: 1280, height: 800 }';

const LAUNCH_FAKES = String.raw`
import { existsSync as exists } from 'node:fs';
const calls = [];
const chromium = {
  launchPersistentContext: async (dir, options) => {
    calls.push({ dir, options });
    if (globalThis.launchFails) throw new Error('launch failed');
    return { close: async () => { calls.push('closed'); } };
  },
};
const report = () => console.log(JSON.stringify(calls[0], (key, value) => value === undefined ? null : value));
`;

function launchProgram(body: string): string {
  return `${scriptPrelude}\n${LAUNCH_FAKES}\n${body}\n`;
}

function runLaunch(body: string, options?: NodeRunOptions) {
  return runNodeModule(launchProgram(body), options);
}

function launched(stdout: string) {
  return JSON.parse(lines(stdout)[0] ?? 'null') as {
    dir: string;
    options: Record<string, unknown>;
  };
}

describe('openContext in the script prelude', () => {
  it('launches a persistent context from the four environment variables', async () => {
    const result = await runLaunch(`
      const env = {
        BROWSER_RECORDER_EXECUTABLE_PATH: process.execPath,
        BROWSER_RECORDER_USER_DATA_DIR: '/profiles/brave/managed',
        BROWSER_RECORDER_BROWSER_ARGS: JSON.stringify(['--profile-directory=Profile 2']),
        BROWSER_RECORDER_REAL_KEYCHAIN: '1',
        BROWSER_RECORDER_HEADLESS: '1',
      };
      await openContext(chromium, ${WINDOW}, env);
      report();`);
    const { dir, options } = launched(result.stdout);
    expect(dir).toBe('/profiles/brave/managed');
    expect(options).toStrictEqual({
      headless: true,
      timeout: 30_000,
      handleSIGINT: false,
      handleSIGTERM: false,
      viewport: null,
      args: ['--window-size=1280,800', '--profile-directory=Profile 2'],
      ignoreDefaultArgs: ['--use-mock-keychain', '--password-store=basic'],
      executablePath: process.execPath,
    });
  });

  it('treats empty variables as unset and runs headed by default', async () => {
    const result = await runLaunch(`
      const env = {
        BROWSER_RECORDER_EXECUTABLE_PATH: '',
        BROWSER_RECORDER_USER_DATA_DIR: '',
        BROWSER_RECORDER_BROWSER_ARGS: '',
        BROWSER_RECORDER_REAL_KEYCHAIN: '',
      };
      const { close } = await openContext(chromium, ${WINDOW}, env);
      report();
      console.log(exists(calls[0].dir));
      await close();
      console.log(exists(calls[0].dir));`);
    const { dir, options } = launched(result.stdout);
    expect(dir).toContain(TEMP_PROFILE_PREFIX);
    expect(options['headless']).toBe(false);
    expect(options).toMatchObject({
      ignoreDefaultArgs: null,
      executablePath: null,
    });
    expect(lines(result.stdout).slice(1)).toStrictEqual(['true', 'false']);
  });

  it('keeps a profile directory it was given when the context closes', async () => {
    const result = await runLaunch(
      `
      const env = { BROWSER_RECORDER_USER_DATA_DIR: process.cwd() + '/given' };
      const { close } = await openContext(chromium, ${WINDOW}, env);
      await close();
      console.log(exists(process.cwd() + '/given'), calls.at(-1));`,
      { files: { 'given/Local State': '{}' } },
    );
    expect(lines(result.stdout)[0]).toBe('true closed');
  });

  it('closes the context once even when close is called twice', async () => {
    const result = await runLaunch(`
      const { close } = await openContext(chromium, ${WINDOW}, {});
      await close();
      await close();
      console.log(calls.filter((call) => call === 'closed').length);`);
    expect(lines(result.stdout)[0]).toBe('1');
  });

  it('removes the temporary profile when the launch fails', async () => {
    const result = await runLaunch(`
      globalThis.launchFails = true;
      try { await openContext(chromium, ${WINDOW}, {}); } catch (error) { console.log(error.message); }
      console.log(exists(calls[0].dir));`);
    expect(lines(result.stdout)).toStrictEqual(['launch failed', 'false']);
  });

  it.each([
    [['--remote-debugging-port=1'], []],
    [
      ['--remote-debugging-port=1', '--profile-directory=Default'],
      ['--profile-directory=Default'],
    ],
    [['--profile-directory=../x'], []],
    [['--profile-directory=Profile 2/../..'], []],
    [['--profile-directory=C:\\\\x'], []],
    [['--profile-directory=Guest Profile'], []],
    [[7, null, '--user-data-dir=/tmp/x'], []],
  ])(
    'accepts only profile directory arguments from %j',
    async (given, kept) => {
      const result = await runLaunch(`
      const env = { BROWSER_RECORDER_BROWSER_ARGS: ${JSON.stringify(JSON.stringify(given))} };
      await openContext(chromium, ${WINDOW}, env);
      report();`);
      expect(launched(result.stdout).options['args']).toStrictEqual([
        '--window-size=1280,800',
        ...kept,
      ]);
    },
  );

  it.each(['not json', '{"a":1}', '"--profile-directory=Default"'])(
    'ignores browser arguments that are not a JSON array: %s',
    async (text) => {
      const result = await runLaunch(`
        const env = { BROWSER_RECORDER_BROWSER_ARGS: ${JSON.stringify(text)} };
        await openContext(chromium, ${WINDOW}, env);
        report();`);
      expect(launched(result.stdout).options['args']).toStrictEqual([
        '--window-size=1280,800',
      ]);
    },
  );

  it('falls back to the bundled browser with a warning when the executable is missing', async () => {
    const result = await runLaunch(`
      const env = { BROWSER_RECORDER_EXECUTABLE_PATH: '/nowhere/brave' };
      await openContext(chromium, ${WINDOW}, env);
      report();`);
    expect(launched(result.stdout).options['executablePath']).toBeNull();
    expect(result.stderr).toContain('Browser not found: /nowhere/brave');
    expect(result.stdout).not.toContain('::');
  });

  it('reads only a literal 1 as the real keychain switch', async () => {
    const result = await runLaunch(`
      const env = { BROWSER_RECORDER_REAL_KEYCHAIN: 'true' };
      await openContext(chromium, ${WINDOW}, env);
      report();`);
    expect(launched(result.stdout).options['ignoreDefaultArgs']).toBeNull();
  });

  it('uses the process environment when none is passed', async () => {
    const result = await runLaunch(
      `await openContext(chromium, ${WINDOW}); report();`,
      { env: { BROWSER_RECORDER_USER_DATA_DIR: '/from/process' } },
    );
    expect(launched(result.stdout).dir).toBe('/from/process');
  });
});

describe('launch rules shared with the recorder', () => {
  const cases = JSON.parse(
    readFileSync(
      path.join(
        import.meta.dirname,
        '..',
        '..',
        'fixtures',
        'launch-parity',
        'cases.json',
      ),
      'utf8',
    ),
  ) as {
    name: string;
    display: unknown;
    target: unknown;
    expected: unknown;
  }[];

  it.each(cases.map((entry) => [entry.name, entry] as const))(
    'builds the golden options for %s',
    async (_name, entry) => {
      const result = await runLaunch(`
        const options = buildLaunchOptions(${JSON.stringify(entry.display)}, ${JSON.stringify(entry.target)});
        console.log(JSON.stringify(options, (key, value) => value === undefined ? null : value));`);
      expect(JSON.parse(lines(result.stdout)[0] ?? 'null')).toStrictEqual(
        entry.expected,
      );
    },
  );
});

describe('script prelude CDP surface', () => {
  const forbidden = new RegExp(
    FORBIDDEN_CDP_DOMAINS.map((domain) => `${domain}\\.enable`).join('|'),
    'u',
  );

  it('never sends the enable calls that make the browser detectable', () => {
    expect(scriptPrelude).toContain('Runtime.callFunctionOn');
    expect(scriptPrelude).not.toMatch(forbidden);
  });
});
