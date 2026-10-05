import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HUMAN_DELAY,
  MAX_DELAY_MS,
  RECORDED_TIMING,
  humanTiming,
  toggleTiming,
} from '../../../src/shared/domain/replay-timing.ts';

describe('src/shared/domain/replay-timing.ts', () => {
  it('defaults the human delay to 250-900 ms', () => {
    expect(DEFAULT_HUMAN_DELAY).toStrictEqual({ minMs: 250, maxMs: 900 });
  });

  it('caps a delay at one minute', () => {
    expect(MAX_DELAY_MS).toBe(60_000);
  });

  it('builds human timing from the default range or a given one', () => {
    expect(humanTiming()).toStrictEqual({
      kind: 'human',
      delay: { minMs: 250, maxMs: 900 },
    });
    expect(humanTiming({ minMs: 10, maxMs: 20 })).toStrictEqual({
      kind: 'human',
      delay: { minMs: 10, maxMs: 20 },
    });
  });

  it('toggles recorded to human and back', () => {
    expect(toggleTiming(RECORDED_TIMING)).toStrictEqual(humanTiming());
    expect(toggleTiming(humanTiming())).toStrictEqual(RECORDED_TIMING);
  });

  it('keeps a custom range only while human and drops it on the way back', () => {
    const custom = humanTiming({ minMs: 5, maxMs: 6 });
    expect(toggleTiming(toggleTiming(custom))).toStrictEqual(humanTiming());
  });
});
