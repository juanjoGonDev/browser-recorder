const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * Formats an offset from session start as `MM:SS.mmm` for timelines. Minutes
 * are not capped, so a long session reads `75:03.200`, never wraps.
 */
export function formatOffset(offsetMs: number): string {
  const total = Number.isFinite(offsetMs)
    ? Math.max(0, Math.floor(offsetMs))
    : 0;
  const minutes = Math.floor(total / MS_PER_MINUTE);
  const seconds = Math.floor((total % MS_PER_MINUTE) / MS_PER_SECOND);
  const millis = total % MS_PER_SECOND;
  return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}
