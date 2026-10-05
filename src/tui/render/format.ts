const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MIN_GAP_MS = 250;
const MAX_GAP_CELLS = 6;
const CREATED_LENGTH = 16;
const GAP_CHAR = '━';

/** Short human gap: `80ms`, `2.4s`. */
export function formatGap(ms: number): string {
  if (Math.abs(ms) < MS_PER_SECOND) return `${String(Math.round(ms))}ms`;
  return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
}

/** A bar whose length grows with the logarithm of the pause, 1 cell at 250 ms. */
export function gapBar(gapMs: number): string {
  if (gapMs < MIN_GAP_MS) return '';
  const cells = 1 + Math.floor(Math.log2(gapMs / MIN_GAP_MS));
  return GAP_CHAR.repeat(Math.min(MAX_GAP_CELLS, cells));
}

/** `m:ss`, minutes uncapped. */
export function formatDuration(ms: number): string {
  const seconds = Number.isFinite(ms)
    ? Math.floor(Math.max(0, ms) / MS_PER_SECOND)
    : 0;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const rest = String(seconds % SECONDS_PER_MINUTE).padStart(2, '0');
  return `${String(minutes)}:${rest}`;
}

/** `YYYY-MM-DD HH:MM` from an ISO timestamp; anything else is shown as is. */
export function formatCreated(iso: string): string {
  const isIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso);
  return isIso ? iso.slice(0, CREATED_LENGTH).replace('T', ' ') : iso;
}

/** Replay drift with an explicit sign: `+12ms`, `-3ms`. */
export function formatDrift(driftMs: number): string {
  const sign = driftMs > 0 ? '+' : '';
  return sign + formatGap(driftMs);
}
