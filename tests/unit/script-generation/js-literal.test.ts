import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

import {
  jsNumber,
  jsString,
  jsStringArray,
} from '../../../src/script-generation/domain/js-literal.ts';
import { checkModuleSyntax } from '../../support/node-check.ts';

const HOSTILE_VALUES = [
  'plain',
  'with "double" quotes',
  'back`tick',
  '${process.exit(1)}',
  'line\nbreak\r\n',
  'separator\u2028and\u2029paragraph',
  'comment */ closer',
  '"); process.exit(1); ("',
  '\\"; evil(); "',
  'lone surrogate \ud800 end',
  '',
];

describe('src/script-generation/domain/js-literal.ts', () => {
  it.each(HOSTILE_VALUES)('round-trips %j exactly', (value) => {
    const literal = jsString(value);
    expect(runInNewContext(`(${literal})`)).toBe(value);
  });

  it.each(HOSTILE_VALUES)('keeps %j a parseable module', (value) => {
    const source = `const value = ${jsString(value)};\nexport default value;\n`;
    expect(checkModuleSyntax(source)).toStrictEqual({
      isValid: true,
      stderr: '',
    });
  });

  it('never emits a raw line terminator', () => {
    const literal = jsString('a\u2028b\u2029c\nd\re');
    const terminators = ['\n', '\r', '\u2028', '\u2029'];
    expect(terminators.filter((char) => literal.includes(char))).toStrictEqual(
      [],
    );
  });

  it('renders arrays element by element', () => {
    const literal = jsStringArray(['a"b', 'c']);
    expect([...(runInNewContext(literal) as string[])]).toStrictEqual([
      'a"b',
      'c',
    ]);
  });

  it('renders an empty array as a literal', () => {
    expect(jsStringArray([])).toBe('[]');
  });

  it('renders finite numbers verbatim', () => {
    expect(jsNumber(1532)).toBe('1532');
    expect(jsNumber(-4.5)).toBe('-4.5');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects the non-finite number %s',
    (value) => {
      expect(() => jsNumber(value)).toThrow(/finite/);
    },
  );
});
