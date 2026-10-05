import { describe, expect, it } from 'vitest';

import {
  formatElapsed,
  formatStepLine,
} from '../../../src/cli/domain/format-step-line.ts';

describe('src/cli/domain/format-step-line.ts', () => {
  it.each([
    [null, ''],
    [0, '0ms'],
    [999, '999ms'],
    [1000, '1.0s'],
    [1234, '1.2s'],
    [61_500, '61.5s'],
  ])('formats an elapsed time of %s as %j', (elapsedMs, text) => {
    expect(formatElapsed(elapsedMs)).toBe(text);
  });

  it('prints index, kind, target and elapsed time', () => {
    expect(
      formatStepLine({
        index: 2,
        total: 12,
        kind: 'click',
        target: 'Save button',
        elapsedMs: 1234,
      }),
    ).toBe('[3/12] click Save button (1.2s)');
  });

  it('leaves out an empty target and an unknown elapsed time', () => {
    expect(
      formatStepLine({
        index: 0,
        total: 4,
        kind: 'reload',
        target: '',
        elapsedMs: null,
      }),
    ).toBe('[1/4] reload');
    expect(
      formatStepLine({
        index: 3,
        total: 4,
        kind: 'reload',
        target: '',
        elapsedMs: 80,
      }),
    ).toBe('[4/4] reload (80ms)');
  });
});
