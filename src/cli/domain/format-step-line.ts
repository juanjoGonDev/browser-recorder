const MS_PER_SECOND = 1000;

export interface StepLine {
  /** Zero-based; the line shows it one-based. */
  readonly index: number;
  readonly total: number;
  readonly kind: string;
  readonly target: string;
  readonly elapsedMs: number | null;
}

/** `250ms` below a second, `1.2s` from there; empty when unknown. */
export function formatElapsed(elapsedMs: number | null): string {
  if (elapsedMs === null) return '';
  return elapsedMs < MS_PER_SECOND
    ? `${String(elapsedMs)}ms`
    : `${(elapsedMs / MS_PER_SECOND).toFixed(1)}s`;
}

/** `[3/12] click Save button (1.2s)`: one line per step. */
export function formatStepLine(line: StepLine): string {
  const elapsed = formatElapsed(line.elapsedMs);
  return [
    `[${String(line.index + 1)}/${String(line.total)}]`,
    line.kind,
    line.target,
    elapsed === '' ? '' : `(${elapsed})`,
  ]
    .filter((part) => part !== '')
    .join(' ');
}
