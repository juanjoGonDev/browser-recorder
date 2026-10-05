import { describe, expect, it } from 'vitest';

import { scriptPrelude } from '../../../src/script-generation/domain/script-prelude.ts';
import { runNodeModule } from '../../support/run-node-module.ts';
import type { NodeRunOptions } from '../../support/run-node-module.ts';

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
