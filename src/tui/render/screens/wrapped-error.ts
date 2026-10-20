import { sanitize } from '../../../shared/domain/terminal-text.ts';
import { cellWidth } from '../layout.ts';
import type { RenderContext } from '../screen-view.ts';
import { wrapText } from '../wrap-text.ts';

const MARK = '✖';
const CONTINUATION_INDENT = '  ';

/**
 * An error too long for the status line, wrapped to the screen width. Empty
 * when `message` fits in `room` cells, so the caller keeps it inline.
 */
export function wrappedErrorLines(
  message: string | null,
  room: number,
  context: RenderContext,
): string[] {
  if (message === null) return [];
  const text = sanitize(message);
  if (cellWidth(`${MARK} ${text}`) <= room) return [];
  const { style, width } = context;
  return wrapText(text, width - CONTINUATION_INDENT.length).map(
    (line, index) =>
      index === 0
        ? `${style.danger(MARK)} ${style.danger(line)}`
        : `${CONTINUATION_INDENT}${style.danger(line)}`,
  );
}
