import { describe, expect, it } from 'vitest';

import { parseDelayRange } from '../../../src/cli/domain/parse-delay-range.ts';

describe('src/cli/domain/parse-delay-range.ts', () => {
  it.each([
    ['100-100', { minMs: 100, maxMs: 100 }],
    ['0-60000', { minMs: 0, maxMs: 60_000 }],
    ['250-900', { minMs: 250, maxMs: 900 }],
    ['007-010', { minMs: 7, maxMs: 10 }],
  ])('accepts %s', (text, range) => {
    expect(parseDelayRange(text)).toStrictEqual({ kind: 'ok', range });
  });

  it.each([
    'abc',
    '1.5-3',
    '-5-10',
    '500',
    '',
    '1-2-3',
    ' 1-2',
    '1 -2',
    '1e3-2e3',
  ])('rejects the malformed range %j and shows the expected shape', (text) => {
    const result = parseDelayRange(text);
    expect(result.kind).toBe('invalid');
    expect(result).toMatchObject({
      message: expect.stringContaining('<min>-<max>') as string,
    });
  });

  it('names the broken rule when min is above max', () => {
    expect(parseDelayRange('900-250')).toStrictEqual({
      kind: 'invalid',
      message:
        '--delay minimum 900 is greater than maximum 250; use <min>-<max> with min <= max.',
    });
  });

  it('names the limit when max is too large', () => {
    expect(parseDelayRange('0-60001')).toStrictEqual({
      kind: 'invalid',
      message: '--delay maximum 60001 is above the limit of 60000 ms.',
    });
    expect(
      parseDelayRange('99999999999999999999-99999999999999999999'),
    ).toMatchObject({
      kind: 'invalid',
    });
  });
});
