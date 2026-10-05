import { describe, expect, it } from 'vitest';

import {
  formatCreated,
  formatDrift,
  formatDuration,
  formatGap,
  gapBar,
  pluralize,
  spinnerFrame,
} from '../../../src/tui/render/format.ts';

describe('src/tui/render/format.ts', () => {
  it('formats gaps in milliseconds below a second and seconds above', () => {
    expect(formatGap(80)).toBe('80ms');
    expect(formatGap(999)).toBe('999ms');
    expect(formatGap(1000)).toBe('1.0s');
    expect(formatGap(2350)).toBe('2.4s');
    expect(formatGap(75_000)).toBe('75.0s');
  });

  it('scales the gap bar with the logarithm of the gap', () => {
    expect(gapBar(0)).toBe('');
    expect(gapBar(249)).toBe('');
    expect(gapBar(250)).toBe('━');
    expect(gapBar(500)).toBe('━━');
    expect(gapBar(1000)).toBe('━━━');
    expect(gapBar(4000)).toBe('━━━━━');
    expect(gapBar(600_000)).toBe('━━━━━━');
  });

  it('formats durations as minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_400)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('62:05');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });

  it('formats the creation date for the library', () => {
    expect(formatCreated('2026-10-05T12:34:56.000Z')).toBe('2026-10-05 12:34');
    expect(formatCreated('garbage')).toBe('garbage');
  });

  it('signs the replay drift', () => {
    expect(formatDrift(12)).toBe('+12ms');
    expect(formatDrift(-3)).toBe('-3ms');
    expect(formatDrift(0)).toBe('0ms');
    expect(formatDrift(1500)).toBe('+1.5s');
  });

  it('animates the spinner from the clock and loops', () => {
    expect(spinnerFrame(0)).toBe('⠋');
    expect(spinnerFrame(80)).toBe('⠙');
    expect(spinnerFrame(80 * 10)).toBe('⠋');
    expect(spinnerFrame(-5)).toBe('⠋');
  });

  it('pluralizes counts', () => {
    expect(pluralize(0, 'event')).toBe('0 events');
    expect(pluralize(1, 'event')).toBe('1 event');
    expect(pluralize(2, 'value')).toBe('2 values');
  });
});
