const ESC = String.fromCharCode(0x1b);
const CURSOR_HOME = `${ESC}[H`;
const CLEAR_LINE_END = `${ESC}[K`;
const CLEAR_BELOW = `${ESC}[J`;

/**
 * The bytes that paint `lines` over the previous frame: no full clear, so
 * there is no flicker, and no newline after the last line, so a full-height
 * frame never scrolls the screen.
 */
export function toFrameText(lines: readonly string[]): string {
  const body = lines.map((line) => line + CLEAR_LINE_END).join('\r\n');
  return CURSOR_HOME + body + CLEAR_BELOW;
}
