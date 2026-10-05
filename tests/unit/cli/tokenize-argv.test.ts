import { describe, expect, it } from 'vitest';

import { tokenizeArgv } from '../../../src/cli/adapters/tokenize-argv.ts';

const DEFAULT_FLAGS = {
  isRandom: false,
  delay: null,
  isHeadless: false,
  isHelp: false,
  isVersion: false,
};

describe('src/cli/adapters/tokenize-argv.ts', () => {
  it('splits a command and its argument', () => {
    expect(tokenizeArgv(['replay', 'demo'])).toStrictEqual({
      kind: 'parsed',
      positionals: ['replay', 'demo'],
      flags: DEFAULT_FLAGS,
    });
  });

  it('reads every flag in its long and short forms', () => {
    expect(
      tokenizeArgv(['replay', 'demo', '-r', '-d', '10-20', '--headless']),
    ).toMatchObject({
      flags: { isRandom: true, delay: '10-20', isHeadless: true },
    });
    expect(
      tokenizeArgv(['replay', 'demo', '--random', '--delay', '5-6']),
    ).toMatchObject({ flags: { isRandom: true, delay: '5-6' } });
    expect(tokenizeArgv(['replay', 'demo', '--delay=7-8'])).toMatchObject({
      flags: { delay: '7-8' },
    });
  });

  it.each([
    [['-h'], { isHelp: true }],
    [['--help'], { isHelp: true }],
    [['-v'], { isVersion: true }],
    [['--version'], { isVersion: true }],
  ])('reads %j', (argv, flags) => {
    expect(tokenizeArgv(argv)).toMatchObject({ kind: 'parsed', flags });
  });

  it('keeps a name that contains spaces as one positional', () => {
    expect(tokenizeArgv(['replay', 'My Flow'])).toMatchObject({
      positionals: ['replay', 'My Flow'],
    });
  });

  it('refuses an unknown flag and names it', () => {
    expect(tokenizeArgv(['replay', 'demo', '--nope'])).toStrictEqual({
      kind: 'rejected',
      message: 'Unknown option "--nope".',
    });
  });

  it('refuses a delay flag without a value and names it', () => {
    const result = tokenizeArgv(['replay', 'demo', '-d']);
    expect(result.kind).toBe('rejected');
    expect(result).toMatchObject({
      message: expect.stringContaining('--delay') as string,
    });
  });

  it('refuses a value given to a switch', () => {
    const result = tokenizeArgv(['replay', 'demo', '--random=yes']);
    expect(result).toMatchObject({
      kind: 'rejected',
      message: expect.stringContaining('--random') as string,
    });
  });

  it('accepts a negative-looking delay only in the equals form, then lets the range check refuse it', () => {
    expect(tokenizeArgv(['replay', 'demo', '--delay=-5-10'])).toMatchObject({
      kind: 'parsed',
      flags: { delay: '-5-10' },
    });
    expect(tokenizeArgv(['replay', 'demo', '-d', '-5-10']).kind).toBe(
      'rejected',
    );
  });
});
