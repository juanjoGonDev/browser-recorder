import { describe, expect, it } from 'vitest';
import { formatOffset } from '../../../src/shared/domain/format-offset.ts';

describe('src/shared/domain/format-offset.ts', () => {
  it.each([
    [0, '00:00.000'],
    [7, '00:00.007'],
    [1532, '00:01.532'],
    [59_999, '00:59.999'],
    [60_000, '01:00.000'],
    [61_250, '01:01.250'],
    [3_600_000, '60:00.000'],
  ])('formats %d ms as %s', (offsetMs, expected) => {
    expect(formatOffset(offsetMs)).toBe(expected);
  });

  it('drops fractional milliseconds instead of rounding up', () => {
    expect(formatOffset(1999.9)).toBe('00:01.999');
  });

  it('clamps a negative or non-finite offset to zero', () => {
    expect(formatOffset(-5)).toBe('00:00.000');
    expect(formatOffset(Number.NaN)).toBe('00:00.000');
    expect(formatOffset(Number.POSITIVE_INFINITY)).toBe('00:00.000');
  });
});
