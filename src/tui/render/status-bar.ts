import type { Style } from './ansi.ts';
import { cellWidth, padEnd } from './layout.ts';

export interface KeyHint {
  readonly key: string;
  readonly label: string;
}

const WIDE_GAP = '  ';
/** Used before clipping, so a long hint list keeps its last keys. */
const NARROW_GAP = ' ';

function joinHints(
  hints: readonly KeyHint[],
  gap: string,
  style: Style,
): string {
  return hints
    .map((hint) => `${style.bold(hint.key)} ${style.muted(hint.label)}`)
    .join(gap);
}

/** The bottom line: `key label` pairs, exactly `width` cells wide. */
export function renderStatusBar(
  hints: readonly KeyHint[],
  width: number,
  style: Style,
): string {
  const roomy = ` ${joinHints(hints, WIDE_GAP, style)}`;
  if (cellWidth(roomy) <= width) return padEnd(roomy, width);
  return padEnd(` ${joinHints(hints, NARROW_GAP, style)}`, width);
}
