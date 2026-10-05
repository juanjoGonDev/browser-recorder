import { describe, expect, it } from 'vitest';

import { createStyle } from '../../../src/tui/render/ansi.ts';
import {
  box,
  cellWidth,
  center,
  clip,
  padEnd,
  sanitize,
  spread,
  stripAnsi,
} from '../../../src/tui/render/layout.ts';

const red = createStyle(true).danger;

describe('src/tui/render/layout.ts', () => {
  it('strips escape sequences', () => {
    expect(stripAnsi(red('hi') + '!')).toBe('hi!');
  });

  it('measures visible cells, counting wide characters twice', () => {
    expect(cellWidth('abc')).toBe(3);
    expect(cellWidth(red('abc'))).toBe(3);
    expect(cellWidth('日本')).toBe(4);
    expect(cellWidth('é')).toBe(1);
  });

  it('clips long text with an ellipsis and leaves short text alone', () => {
    expect(clip('hello world', 8)).toBe('hello w…');
    expect(clip('hello', 8)).toBe('hello');
    expect(clip('日本語', 5)).toBe('日本…');
    expect(clip('abc', 0)).toBe('');
  });

  it('clips colored text without breaking the color or the width', () => {
    const clipped = clip(red('hello world'), 8);
    expect(stripAnsi(clipped)).toBe('hello w…');
    expect(cellWidth(clipped)).toBe(8);
    expect(clipped.endsWith('\u001b[0m')).toBe(true);
  });

  it('pads to an exact width', () => {
    expect(padEnd('ab', 5)).toBe('ab   ');
    expect(cellWidth(padEnd(red('ab'), 5))).toBe(5);
    expect(padEnd('abcdef', 3)).toBe('ab…');
  });

  it('centers text and spreads a left and a right part', () => {
    expect(center('ab', 6)).toBe('  ab  ');
    expect(spread('left', 'right', 14)).toBe('left     right');
    expect(spread('a very long left side', 'right', 12)).toBe('a ver… right');
  });

  it('replaces control characters so recorded text cannot move the cursor', () => {
    expect(sanitize('a\u001b[2Jb\nc\u0007')).toBe('a·[2Jb·c·');
    expect(sanitize('tab\there')).toBe('tab·here');
  });

  it('draws a titled box of exactly the requested size', () => {
    const lines = box({
      title: 'Title',
      body: ['one', 'two'],
      width: 14,
      height: 5,
    });
    expect(lines).toEqual([
      '╭─ Title ────╮',
      '│ one        │',
      '│ two        │',
      '│            │',
      '╰────────────╯',
    ]);
  });

  it('truncates body lines that do not fit and drops extra rows', () => {
    const lines = box({
      title: 'T',
      body: ['this line is far too long', 'b', 'c', 'd'],
      width: 12,
      height: 4,
    });
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe('│ this li… │');
    expect(lines.map(cellWidth)).toEqual([12, 12, 12, 12]);
  });
});
