import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { createStreamOutput } from '../../../src/cli/adapters/stream-output.ts';

function streams(isTty = false) {
  const stdout = Object.assign(new PassThrough(), { isTTY: isTty });
  const stderr = Object.assign(new PassThrough(), { isTTY: isTty });
  let out = '';
  let err = '';
  stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
  stderr.on('data', (chunk: Buffer) => (err += chunk.toString()));
  return { stdout, stderr, text: () => ({ out, err }) };
}

describe('src/cli/adapters/stream-output.ts', () => {
  it('writes each stream to its own stream', async () => {
    const { stdout, stderr, text } = streams();
    const output = createStreamOutput({ stdout, stderr, env: {} });
    output.out('one\n');
    output.err('two\n');
    await output.flush();
    expect(text()).toStrictEqual({ out: 'one\n', err: 'two\n' });
  });

  it('flush settles only after the pending writes were handed over', async () => {
    const stdout = Object.assign(new PassThrough({ highWaterMark: 1 }), {
      isTTY: false,
    });
    const chunks: string[] = [];
    const output = createStreamOutput({
      stdout,
      stderr: Object.assign(new PassThrough(), { isTTY: false }),
      env: {},
    });
    output.out('a'.repeat(1000));
    const flushed = output.flush();
    stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    await flushed;
    expect(chunks.join('')).toBe('a'.repeat(1000));
  });

  it('ignores a closed pipe instead of crashing', async () => {
    const { stdout, stderr } = streams();
    const output = createStreamOutput({ stdout, stderr, env: {} });
    stdout.emit(
      'error',
      Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }),
    );
    stdout.destroy();
    output.out('after the reader left\n');
    await expect(output.flush()).resolves.toBeUndefined();
  });

  it('rethrows an error that is not a closed pipe', () => {
    const { stdout, stderr } = streams();
    createStreamOutput({ stdout, stderr, env: {} });
    expect(() =>
      stdout.emit('error', Object.assign(new Error('disk'), { code: 'EIO' })),
    ).toThrow('disk');
  });

  it.each([
    [true, {}, true],
    [true, { NO_COLOR: '1' }, false],
    [true, { TERM: 'dumb' }, false],
    [false, {}, false],
  ])('color on a tty=%s with env %j is %s', (isTty, env, isColored) => {
    const { stdout, stderr } = streams(isTty);
    const output = createStreamOutput({ stdout, stderr, env });
    expect(output.hasOutColor).toBe(isColored);
    expect(output.hasErrColor).toBe(isColored);
  });

  it('colors stderr only when stdout is a terminal too', () => {
    const stdout = Object.assign(new PassThrough(), { isTTY: false });
    const stderr = Object.assign(new PassThrough(), { isTTY: true });
    const output = createStreamOutput({ stdout, stderr, env: {} });
    expect(output.hasOutColor).toBe(false);
    expect(output.hasErrColor).toBe(false);
  });

  it('keeps stderr plain when stdout is a terminal but stderr is piped', () => {
    const stdout = Object.assign(new PassThrough(), { isTTY: true });
    const stderr = Object.assign(new PassThrough(), { isTTY: false });
    const output = createStreamOutput({ stdout, stderr, env: {} });
    expect(output.hasOutColor).toBe(true);
    expect(output.hasErrColor).toBe(false);
  });
});
