import {
  MAX_DELAY_MS,
  type DelayRange,
} from '../../shared/domain/replay-timing.ts';

export type DelayParse =
  | { readonly kind: 'ok'; readonly range: DelayRange }
  | { readonly kind: 'invalid'; readonly message: string };

/** Whole base-10 numbers only: no sign, no decimals, no exponent. */
const RANGE_PATTERN = /^(\d+)-(\d+)$/u;

function invalid(message: string): DelayParse {
  return { kind: 'invalid', message };
}

/** `<min>-<max>` in milliseconds, `0 <= min <= max <= 60000`. */
export function parseDelayRange(text: string): DelayParse {
  const match = RANGE_PATTERN.exec(text);
  if (match === null) {
    return invalid(
      `--delay expects <min>-<max> in whole milliseconds, for example 250-900 (got "${text}").`,
    );
  }
  const minMs = Number(match[1]);
  const maxMs = Number(match[2]);
  if (maxMs > MAX_DELAY_MS) {
    return invalid(
      `--delay maximum ${String(maxMs)} is above the limit of ${String(MAX_DELAY_MS)} ms.`,
    );
  }
  if (minMs > maxMs) {
    return invalid(
      `--delay minimum ${String(minMs)} is greater than maximum ${String(maxMs)}; use <min>-<max> with min <= max.`,
    );
  }
  return { kind: 'ok', range: { minMs, maxMs } };
}
