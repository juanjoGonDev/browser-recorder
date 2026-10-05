import type { ReplayTiming } from '../../shared/domain/replay-timing.ts';

const TIMING_ENV = 'BROWSER_RECORDER_TIMING';
const DELAY_ENV = 'BROWSER_RECORDER_HUMAN_DELAY';
const SEED_ENV = 'BROWSER_RECORDER_SEED';
/** Same rule the generated script applies: at most ten decimal digits. */
const SEED_PATTERN = /^\d{1,10}$/u;

/**
 * The variables that carry the timing to a generated script. Timing and delay
 * are always set so a value inherited from the shell can never win; the seed
 * only exists for tests and is passed on only when it is well formed.
 */
export function timingEnvironment(
  timing: ReplayTiming,
  parentEnv: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const seed = parentEnv[SEED_ENV];
  const isSeedValid = seed !== undefined && SEED_PATTERN.test(seed);
  return {
    [TIMING_ENV]: timing.kind,
    [DELAY_ENV]:
      timing.kind === 'human'
        ? `${String(timing.delay.minMs)}-${String(timing.delay.maxMs)}`
        : '',
    ...(isSeedValid ? { [SEED_ENV]: seed } : {}),
  };
}
