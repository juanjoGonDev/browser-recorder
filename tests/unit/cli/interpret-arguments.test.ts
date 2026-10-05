import { describe, expect, it } from 'vitest';

import {
  interpretArguments,
  type ParsedArguments,
  type RawFlags,
} from '../../../src/cli/domain/interpret-arguments.ts';
import {
  RECORDED_TIMING,
  humanTiming,
} from '../../../src/shared/domain/replay-timing.ts';

const NO_FLAGS: RawFlags = {
  isRandom: false,
  delay: null,
  isHeadless: false,
  isHelp: false,
  isVersion: false,
};

function parsed(
  positionals: string[],
  flags: Partial<RawFlags> = {},
): ParsedArguments {
  return {
    kind: 'parsed',
    positionals,
    flags: { ...NO_FLAGS, ...flags },
  };
}

describe('src/cli/domain/interpret-arguments.ts', () => {
  it('replays the named recording with recorded timing by default', () => {
    expect(interpretArguments(parsed(['replay', 'demo']))).toStrictEqual({
      kind: 'replay',
      query: 'demo',
      timing: RECORDED_TIMING,
      isHeadless: false,
    });
  });

  it('keeps a name with spaces as one argument', () => {
    expect(interpretArguments(parsed(['replay', 'My Flow']))).toMatchObject({
      kind: 'replay',
      query: 'My Flow',
    });
  });

  it('uses the default human range for -r alone', () => {
    expect(
      interpretArguments(parsed(['replay', 'demo'], { isRandom: true })),
    ).toMatchObject({ timing: humanTiming() });
  });

  it('implies human timing for -d alone and honours its range', () => {
    expect(
      interpretArguments(parsed(['replay', 'demo'], { delay: '10-20' })),
    ).toMatchObject({ timing: humanTiming({ minMs: 10, maxMs: 20 }) });
    expect(
      interpretArguments(
        parsed(['replay', 'demo'], { isRandom: true, delay: '5-6' }),
      ),
    ).toMatchObject({ timing: humanTiming({ minMs: 5, maxMs: 6 }) });
  });

  it('passes the headless flag along', () => {
    expect(
      interpretArguments(parsed(['replay', 'demo'], { isHeadless: true })),
    ).toMatchObject({ isHeadless: true });
  });

  it('reports an invalid range as a usage error', () => {
    const command = interpretArguments(
      parsed(['replay', 'demo'], { delay: '900-250' }),
    );
    expect(command).toMatchObject({ kind: 'usage-error' });
    expect(command).toMatchObject({
      message: expect.stringContaining('minimum 900') as string,
    });
  });

  it.each([
    [{ isHelp: true }, 'help'],
    [{ isVersion: true }, 'version'],
  ] as const)('prints %j without needing a command', (flags, kind) => {
    expect(interpretArguments(parsed([], flags))).toStrictEqual({ kind });
    expect(interpretArguments(parsed(['replay', 'demo'], flags))).toStrictEqual(
      {
        kind,
      },
    );
  });

  it('prefers help over version when both are given', () => {
    expect(
      interpretArguments(parsed([], { isHelp: true, isVersion: true })),
    ).toStrictEqual({ kind: 'help' });
  });

  it('rejects an unknown subcommand', () => {
    expect(interpretArguments(parsed(['foo']))).toStrictEqual({
      kind: 'usage-error',
      message: 'Unknown command "foo".',
    });
  });

  it('asks for a command when only flags were given', () => {
    expect(interpretArguments(parsed([], { isHeadless: true }))).toStrictEqual({
      kind: 'usage-error',
      message: 'Missing command: use "replay <name|slug>".',
    });
  });

  it('names the missing recording argument', () => {
    expect(interpretArguments(parsed(['replay']))).toStrictEqual({
      kind: 'usage-error',
      message: 'Missing argument: replay needs a <name|slug>.',
    });
  });

  it('rejects extra positional arguments', () => {
    expect(interpretArguments(parsed(['replay', 'a', 'b']))).toStrictEqual({
      kind: 'usage-error',
      message: 'Unexpected argument "b".',
    });
  });

  it('turns a rejected command line into a usage error with its reason', () => {
    expect(
      interpretArguments({
        kind: 'rejected',
        message: 'Unknown option "--nope".',
      }),
    ).toStrictEqual({
      kind: 'usage-error',
      message: 'Unknown option "--nope".',
    });
  });
});
