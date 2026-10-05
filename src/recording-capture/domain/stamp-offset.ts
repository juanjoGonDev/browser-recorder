export interface OffsetInput {
  /** Monotonic clock reading when Node received the signal. */
  readonly receivedAt: number;
  /** Monotonic clock reading at session start. */
  readonly t0: number;
  /** How long before the report the real moment happened. */
  readonly ageMs: number;
  readonly previousOffsetMs: number;
}

/**
 * Milliseconds from session start for one event. The previous offset is a
 * floor so offsets stay non-decreasing even when an old `ageMs` or a clock
 * jump would place an event before the one recorded earlier.
 */
export function stampOffset(input: OffsetInput): number {
  const measured = input.receivedAt - input.t0 - input.ageMs;
  return Math.round(Math.max(input.previousOffsetMs, measured));
}
