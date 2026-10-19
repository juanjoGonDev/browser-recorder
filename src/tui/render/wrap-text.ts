import { cellWidth } from './layout.ts';

/** Cuts a word wider than `width` into pieces that each fit. */
function splitWord(word: string, width: number): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const character of Array.from(word)) {
    if (piece !== '' && cellWidth(piece + character) > width) {
      pieces.push(piece);
      piece = '';
    }
    piece += character;
  }
  return piece === '' ? pieces : [...pieces, piece];
}

/**
 * Word wrap by terminal cells for plain text (style it afterwards). Blank text
 * yields no lines; a word wider than the width is split.
 */
export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter((part) => part !== '')) {
    const pieces = cellWidth(word) > width ? splitWord(word, width) : [word];
    for (const piece of pieces) {
      const candidate = line === '' ? piece : `${line} ${piece}`;
      if (cellWidth(candidate) <= width) {
        line = candidate;
      } else {
        lines.push(line);
        line = piece;
      }
    }
  }
  return line === '' ? lines : [...lines, line];
}
