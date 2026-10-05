/** Border rows (2), status bar (1) and the two header rows of a list screen. */
const CHROME_ROWS = 5;

/** Below this the layout cannot fit, so a short notice is drawn instead. */
export const MIN_COLUMNS = 40;
export const MIN_ROWS = 10;

/** Rows a list may use on a terminal of `terminalRows` rows. */
export function listRowsFor(terminalRows: number): number {
  return Math.max(1, terminalRows - CHROME_ROWS);
}
