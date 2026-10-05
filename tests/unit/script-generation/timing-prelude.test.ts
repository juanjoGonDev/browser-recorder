import { describe, expect, it } from 'vitest';

import {
  loadTimingPrelude,
  recordingSleep,
} from '../../support/load-timing-prelude.ts';

const { createTiming, readDelayRange, readSeed } = loadTimingPrelude();
const HUMAN = {
  BROWSER_RECORDER_TIMING: 'human',
  BROWSER_RECORDER_HUMAN_DELAY: '250-900',
  BROWSER_RECORDER_SEED: '7',
};
const ACTION = { isFollowUp: false };

async function stepWaits(
  env: Record<string, string>,
  steps: number,
): Promise<number[]> {
  const { sleep, waits } = recordingSleep();
  const timing = createTiming(env, sleep);
  for (let step = 0; step < steps; step += 1) {
    await timing.beforeStep(ACTION);
  }
  return waits;
}

describe('src/script-generation/domain/timing-prelude.ts', () => {
  it('treats an unknown mode as recorded', () => {
    expect(
      createTiming({ BROWSER_RECORDER_TIMING: 'banana' }, () =>
        Promise.resolve(),
      ).isHuman,
    ).toBe(false);
    expect(createTiming({}, () => Promise.resolve()).isHuman).toBe(false);
    expect(
      createTiming({ BROWSER_RECORDER_TIMING: 'human' }, () =>
        Promise.resolve(),
      ).isHuman,
    ).toBe(true);
  });

  it('never waits in recorded mode', async () => {
    const waits = await stepWaits({ BROWSER_RECORDER_TIMING: 'recorded' }, 4);
    expect(waits).toStrictEqual([]);
  });

  it('does not wait before the first step and waits between the others', async () => {
    const waits = await stepWaits(HUMAN, 4);
    expect(waits).toHaveLength(3);
  });

  it('keeps every inter-step wait inside the range', async () => {
    const waits = await stepWaits(HUMAN, 200);
    expect(waits).toHaveLength(199);
    expect(Math.min(...waits)).toBeGreaterThanOrEqual(250);
    expect(Math.max(...waits)).toBeLessThanOrEqual(900);
    expect(new Set(waits).size).toBeGreaterThan(50);
  });

  it('uses the exact value when the range is a single point', async () => {
    const waits = await stepWaits(
      { ...HUMAN, BROWSER_RECORDER_HUMAN_DELAY: '100-100' },
      5,
    );
    expect(waits).toStrictEqual([100, 100, 100, 100]);
  });

  it('never waits before a follow-up step', async () => {
    const { sleep, waits } = recordingSleep();
    const timing = createTiming(HUMAN, sleep);
    await timing.beforeStep(ACTION);
    await timing.beforeStep({ isFollowUp: true });
    expect(waits).toStrictEqual([]);
    await timing.beforeStep(ACTION);
    expect(waits).toHaveLength(1);
  });

  it('lets a leading follow-up pass without using up the first action', async () => {
    const { sleep, waits } = recordingSleep();
    const timing = createTiming(HUMAN, sleep);
    await timing.beforeStep({ isFollowUp: true });
    await timing.beforeStep(ACTION);
    expect(waits).toStrictEqual([]);
    await timing.beforeStep(ACTION);
    expect(waits).toHaveLength(1);
  });

  it('computes the same sequence for the same seed and another for a different one', async () => {
    const first = await stepWaits(HUMAN, 12);
    const second = await stepWaits(HUMAN, 12);
    const other = await stepWaits({ ...HUMAN, BROWSER_RECORDER_SEED: '8' }, 12);
    expect(second).toStrictEqual(first);
    expect(other).not.toStrictEqual(first);
  });

  it('draws key pauses from a tenth of the range', async () => {
    const { sleep, waits } = recordingSleep();
    const timing = createTiming(
      { ...HUMAN, BROWSER_RECORDER_HUMAN_DELAY: '100-400' },
      sleep,
    );
    for (let key = 0; key < 100; key += 1) await timing.keyPause();
    expect(waits).toHaveLength(100);
    expect(Math.min(...waits)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...waits)).toBeLessThanOrEqual(40);
  });

  it.each([
    ['250-900', { minMs: 250, maxMs: 900 }],
    ['0-60000', { minMs: 0, maxMs: 60_000 }],
    ['5-5', { minMs: 5, maxMs: 5 }],
  ])('reads the range %s', (text, expected) => {
    expect(readDelayRange(text)).toStrictEqual(expected);
  });

  it.each([
    undefined,
    '',
    'abc',
    '900-250',
    '0-60001',
    '1.5-3',
    '-5-10',
    '500',
  ])('falls back to the default range for %j', (text) => {
    expect(readDelayRange(text)).toStrictEqual({ minMs: 250, maxMs: 900 });
  });

  it('reads a seed of up to ten digits as an unsigned 32-bit number', () => {
    expect(readSeed('7')).toBe(7);
    expect(readSeed('4294967295')).toBe(4_294_967_295);
    expect(readSeed('4294967297')).toBe(1);
  });

  it.each([undefined, '', 'x', '-1', '1.5', '12345678901'])(
    'draws a random seed instead of trusting %j',
    (text) => {
      const seed = readSeed(text);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(4_294_967_295);
    },
  );
});
