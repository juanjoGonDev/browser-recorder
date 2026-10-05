import { describe, expect, it } from 'vitest';
import { stampOffset } from '../../../src/recording-capture/domain/stamp-offset.ts';

describe('src/recording-capture/domain/stamp-offset.ts', () => {
  it('measures from the session start at Node receipt', () => {
    expect(
      stampOffset({
        receivedAt: 1500,
        t0: 1000,
        ageMs: 0,
        previousOffsetMs: 0,
      }),
    ).toBe(500);
    expect(
      stampOffset({
        receivedAt: 9000,
        t0: 1000,
        ageMs: 0,
        previousOffsetMs: 10,
      }),
    ).toBe(8000);
  });

  it('places an event earlier by the age reported in the page', () => {
    expect(
      stampOffset({
        receivedAt: 2000,
        t0: 1000,
        ageMs: 300,
        previousOffsetMs: 0,
      }),
    ).toBe(700);
  });

  it('rounds to an integer number of milliseconds', () => {
    expect(
      stampOffset({
        receivedAt: 1000.6,
        t0: 1000,
        ageMs: 0,
        previousOffsetMs: 0,
      }),
    ).toBe(1);
    expect(
      stampOffset({
        receivedAt: 1000.4,
        t0: 1000,
        ageMs: 0,
        previousOffsetMs: 0,
      }),
    ).toBe(0);
  });

  it('never moves backward when the clock jumps back', () => {
    expect(
      stampOffset({
        receivedAt: 1200,
        t0: 1000,
        ageMs: 0,
        previousOffsetMs: 800,
      }),
    ).toBe(800);
  });

  it('never moves backward when a long age places an event before the previous one', () => {
    expect(
      stampOffset({
        receivedAt: 1100,
        t0: 1000,
        ageMs: 500,
        previousOffsetMs: 40,
      }),
    ).toBe(40);
  });
});
