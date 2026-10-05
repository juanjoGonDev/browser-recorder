import type { Style } from './ansi.ts';
import type { KeyHint } from './status-bar.ts';

/** What a screen renderer may know about the terminal besides its own state. */
export interface RenderContext {
  /** Cells available inside the frame border. */
  readonly width: number;
  /** Rows available inside the frame border. */
  readonly height: number;
  readonly style: Style;
  readonly nowMs: number;
  readonly linuxHint: string | null;
}

/** A screen's contribution to a frame: the box content and its key hints. */
export interface ScreenView {
  readonly title: string;
  readonly body: readonly string[];
  readonly hints: readonly KeyHint[];
}

/** Rows a list may use: the body minus the two header rows of a list screen. */
export const LIST_HEADER_ROWS = 2;

export function listRowsOf(context: RenderContext): number {
  return Math.max(1, context.height - LIST_HEADER_ROWS);
}

export function rule(context: RenderContext): string {
  return context.style.muted('─'.repeat(context.width));
}
