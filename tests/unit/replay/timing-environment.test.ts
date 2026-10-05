import { describe, expect, it } from 'vitest';

import { timingEnvironment } from '../../../src/replay/domain/timing-environment.ts';
import {
  RECORDED_TIMING,
  humanTiming,
} from '../../../src/shared/domain/replay-timing.ts';

describe('src/replay/domain/timing-environment.ts', () => {
  it('maps human timing to its mode and range', () => {
    expect(timingEnvironment(humanTiming(), {})).toStrictEqual({
      BROWSER_RECORDER_TIMING: 'human',
      BROWSER_RECORDER_HUMAN_DELAY: '250-900',
    });
  });

  it('maps a custom range', () => {
    expect(
      timingEnvironment(humanTiming({ minMs: 10, maxMs: 20 }), {}),
    ).toStrictEqual({
      BROWSER_RECORDER_TIMING: 'human',
      BROWSER_RECORDER_HUMAN_DELAY: '10-20',
    });
  });

  it('always sets both variables so an inherited value cannot leak in', () => {
    expect(timingEnvironment(RECORDED_TIMING, {})).toStrictEqual({
      BROWSER_RECORDER_TIMING: 'recorded',
      BROWSER_RECORDER_HUMAN_DELAY: '',
    });
  });

  it('forwards a valid seed from the parent environment', () => {
    const env = { BROWSER_RECORDER_SEED: '42' };
    expect(timingEnvironment(humanTiming(), env)).toMatchObject({
      BROWSER_RECORDER_SEED: '42',
    });
    expect(timingEnvironment(RECORDED_TIMING, env)).toMatchObject({
      BROWSER_RECORDER_SEED: '42',
    });
  });

  it.each(['abc', '-1', '1.5', '12345678901', ''])(
    'drops the invalid seed %j',
    (seed) => {
      const result = timingEnvironment(humanTiming(), {
        BROWSER_RECORDER_SEED: seed,
      });
      expect(result).not.toHaveProperty('BROWSER_RECORDER_SEED');
    },
  );

  it('sets no seed when the parent has none', () => {
    expect(timingEnvironment(humanTiming(), {})).not.toHaveProperty(
      'BROWSER_RECORDER_SEED',
    );
  });
});
