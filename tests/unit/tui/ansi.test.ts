import { describe, expect, it } from 'vitest';

import { createStyle, isColorEnabled } from '../../../src/tui/render/ansi.ts';
import { stripAnsi } from '../../../src/tui/render/layout.ts';

describe('src/tui/render/ansi.ts', () => {
  it('wraps text in escape codes when color is on', () => {
    const style = createStyle(true);
    expect(style.danger('x')).toBe('\u001b[31mx\u001b[39m');
    expect(style.bold('x')).toBe('\u001b[1mx\u001b[22m');
    expect(style.inverse('x')).toBe('\u001b[7mx\u001b[27m');
  });

  it('returns every text untouched when color is off', () => {
    const style = createStyle(false);
    for (const paint of [
      style.accent,
      style.bold,
      style.danger,
      style.dim,
      style.inverse,
      style.muted,
      style.success,
      style.warning,
    ]) {
      expect(paint('plain')).toBe('plain');
    }
  });

  it('keeps nested styles balanced', () => {
    const style = createStyle(true);
    expect(stripAnsi(style.bold(style.accent('ab')))).toBe('ab');
    expect(style.bold(style.accent('ab'))).toBe(
      '\u001b[1m\u001b[36mab\u001b[39m\u001b[22m',
    );
  });

  it('honours NO_COLOR and dumb terminals', () => {
    expect(isColorEnabled({})).toBe(true);
    expect(isColorEnabled({ NO_COLOR: '1' })).toBe(false);
    expect(isColorEnabled({ NO_COLOR: '' })).toBe(true);
    expect(isColorEnabled({ TERM: 'dumb' })).toBe(false);
    expect(isColorEnabled({ TERM: 'xterm-256color' })).toBe(true);
  });
});
