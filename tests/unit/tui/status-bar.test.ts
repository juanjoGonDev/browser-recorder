import { describe, expect, it } from 'vitest';

import { createStyle } from '../../../src/tui/render/ansi.ts';
import { cellWidth } from '../../../src/tui/render/layout.ts';
import { renderStatusBar } from '../../../src/tui/render/status-bar.ts';

const hints = [
  { key: '↑↓', label: 'move' },
  { key: 'enter', label: 'open' },
  { key: 'q', label: 'quit' },
];

describe('src/tui/render/status-bar.ts', () => {
  it('lists each key with its label', () => {
    expect(renderStatusBar(hints, 40, createStyle(false))).toBe(
      ' ↑↓ move  enter open  q quit'.padEnd(40, ' '),
    );
  });

  it('is exactly as wide as the terminal and clips when it cannot fit', () => {
    const narrow = renderStatusBar(hints, 14, createStyle(false));
    expect(cellWidth(narrow)).toBe(14);
    expect(narrow.endsWith('…')).toBe(true);
  });

  it('colors keys and labels differently', () => {
    const colored = renderStatusBar(hints, 40, createStyle(true));
    expect(colored).toContain('\u001b[1m');
    expect(cellWidth(colored)).toBe(40);
  });
});
