import { describe, expect, it } from 'vitest';

import { cellWidth } from '../../../src/tui/render/layout.ts';
import { wrapText } from '../../../src/tui/render/wrap-text.ts';

describe('src/tui/render/wrap-text.ts', () => {
  it('breaks a long sentence at word boundaries within the width', () => {
    const lines = wrapText('the quick brown fox jumps over the lazy dog', 15);
    expect(lines).toEqual([
      'the quick brown',
      'fox jumps over',
      'the lazy dog',
    ]);
  });

  it('keeps text that fits exactly on one line', () => {
    expect(wrapText('12345 67890', 11)).toEqual(['12345 67890']);
    expect(wrapText('12345 67890', 10)).toEqual(['12345', '67890']);
  });

  it('splits a word longer than the width by cells', () => {
    expect(wrapText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrapText('ab abcdefgh', 4)).toEqual(['ab', 'abcd', 'efgh']);
  });

  it('measures wide characters as two cells', () => {
    const lines = wrapText('日本語 日本語', 6);
    expect(lines).toEqual(['日本語', '日本語']);
    expect(lines.every((line) => cellWidth(line) <= 6)).toBe(true);
  });

  it('returns no lines for empty or blank text', () => {
    expect(wrapText('', 10)).toEqual([]);
    expect(wrapText('   ', 10)).toEqual([]);
  });

  it('returns no lines when there is no room', () => {
    expect(wrapText('hello', 0)).toEqual([]);
  });
});
