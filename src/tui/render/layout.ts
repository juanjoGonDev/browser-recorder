const ESC = '\u001b';
const ELLIPSIS = '…';
const RESET = `${ESC}[0m`;
const MIN_FINAL_BYTE = 0x40;
const MAX_FINAL_BYTE = 0x7e;
const BORDER_PADDING = 4;

type CodePointRange = readonly [number, number];

const ZERO_WIDTH: readonly CodePointRange[] = [
  [0x0300, 0x036f],
  [0x200b, 0x200f],
  [0xfe00, 0xfe0f],
];

const DOUBLE_WIDTH: readonly CodePointRange[] = [
  [0x1100, 0x115f],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x3fffd],
];

function isIn(ranges: readonly CodePointRange[], codePoint: number): boolean {
  return ranges.some(([low, high]) => codePoint >= low && codePoint <= high);
}

function characterWidth(character: string): number {
  const codePoint = character.codePointAt(0) ?? 0;
  if (isIn(ZERO_WIDTH, codePoint)) return 0;
  return isIn(DOUBLE_WIDTH, codePoint) ? 2 : 1;
}

/** Index just after the escape sequence starting at `start`. */
function escapeEnd(text: string, start: number): number {
  let index = start + 2;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    index += 1;
    if (code >= MIN_FINAL_BYTE && code <= MAX_FINAL_BYTE) break;
  }
  return index;
}

function isEscapeAt(text: string, index: number): boolean {
  return text[index] === ESC && text[index + 1] === '[';
}

export function stripAnsi(text: string): string {
  let result = '';
  let index = 0;
  while (index < text.length) {
    if (isEscapeAt(text, index)) {
      index = escapeEnd(text, index);
    } else {
      result += text[index] ?? '';
      index += 1;
    }
  }
  return result;
}

/** Terminal cells the text occupies once escape codes are ignored. */
export function cellWidth(text: string): number {
  return Array.from(stripAnsi(text)).reduce(
    (total, character) => total + characterWidth(character),
    0,
  );
}

interface Walk {
  readonly text: string;
  readonly isEscaped: boolean;
}

function takeCells(text: string, budget: number): Walk {
  let kept = '';
  let used = 0;
  let isEscaped = false;
  let index = 0;
  while (index < text.length) {
    if (isEscapeAt(text, index)) {
      const end = escapeEnd(text, index);
      kept += text.slice(index, end);
      isEscaped = true;
      index = end;
      continue;
    }
    const character = String.fromCodePoint(text.codePointAt(index) ?? 0);
    used += characterWidth(character);
    if (used > budget) break;
    kept += character;
    index += character.length;
  }
  return { text: kept, isEscaped };
}

/** Cuts text to `width` cells, ending with an ellipsis when it was cut. */
export function clip(text: string, width: number): string {
  if (width <= 0) return '';
  if (cellWidth(text) <= width) return text;
  const walk = takeCells(text, width - 1);
  return walk.text + ELLIPSIS + (walk.isEscaped ? RESET : '');
}

export function padEnd(text: string, width: number): string {
  const fitted = clip(text, width);
  return fitted + ' '.repeat(Math.max(0, width - cellWidth(fitted)));
}

export function center(text: string, width: number): string {
  const fitted = clip(text, width);
  const free = Math.max(0, width - cellWidth(fitted));
  const left = Math.floor(free / 2);
  return ' '.repeat(left) + fitted + ' '.repeat(free - left);
}

/** `left` at the start and `right` at the end of a line of `width` cells. */
export function spread(left: string, right: string, width: number): string {
  const rightWidth = cellWidth(right);
  const room = width - rightWidth - 1;
  if (cellWidth(left) <= room) {
    return padEnd(left, width - rightWidth) + right;
  }
  return room <= 0 ? clip(right, width) : `${clip(left, room)} ${right}`;
}

export interface BoxSpec {
  readonly title: string;
  readonly body: readonly string[];
  readonly width: number;
  readonly height: number;
}

function topBorder(title: string, width: number): string {
  const label = `─ ${clip(title, Math.max(0, width - BORDER_PADDING))} `;
  const fill = '─'.repeat(Math.max(0, width - 2 - cellWidth(label)));
  return `╭${label}${fill}╮`;
}

/** A rounded box; `body` lines are clipped and padded to the inner width. */
export function box(spec: BoxSpec): string[] {
  const innerWidth = spec.width - BORDER_PADDING;
  const bodyRows = Math.max(0, spec.height - 2);
  const rows = Array.from({ length: bodyRows }, (_, index) => {
    const line = spec.body[index] ?? '';
    return `│ ${padEnd(line, innerWidth)} │`;
  });
  return [
    topBorder(spec.title, spec.width),
    ...rows,
    `╰${'─'.repeat(spec.width - 2)}╯`,
  ];
}
