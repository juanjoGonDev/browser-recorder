import type { Style } from './ansi.ts';
import { padEnd } from './layout.ts';

export interface KeyHint {
  readonly key: string;
  readonly label: string;
}

/** The bottom line: `key label` pairs, exactly `width` cells wide. */
export function renderStatusBar(
  hints: readonly KeyHint[],
  width: number,
  style: Style,
): string {
  const text = hints
    .map((hint) => `${style.bold(hint.key)} ${style.muted(hint.label)}`)
    .join('  ');
  return padEnd(` ${text}`, width);
}
