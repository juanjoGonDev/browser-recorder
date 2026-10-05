/** An inclusive range of milliseconds a human-like pause is drawn from. */
export interface DelayRange {
  readonly minMs: number;
  readonly maxMs: number;
}

/**
 * How a replay is paced. `recorded` keeps the offsets of the recording;
 * `human` waits a random delay in range between actions. It is a replay-time
 * choice and is never written into a recording.
 */
export type ReplayTiming =
  | { readonly kind: 'recorded' }
  | { readonly kind: 'human'; readonly delay: DelayRange };

export const DEFAULT_HUMAN_DELAY: DelayRange = { minMs: 250, maxMs: 900 };

/** The longest pause a user may ask for: one minute. */
export const MAX_DELAY_MS = 60_000;

export const RECORDED_TIMING: ReplayTiming = { kind: 'recorded' };

export function humanTiming(
  delay: DelayRange = DEFAULT_HUMAN_DELAY,
): ReplayTiming {
  return { kind: 'human', delay };
}

/** The other mode: human always starts from the default range. */
export function toggleTiming(timing: ReplayTiming): ReplayTiming {
  return timing.kind === 'recorded' ? humanTiming() : RECORDED_TIMING;
}
