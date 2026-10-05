import type { KeyPress } from '../../src/tui/application/ports/terminal.ts';

export function named(
  name: string,
  modifiers: Partial<Pick<KeyPress, 'ctrl' | 'meta' | 'shift'>> = {},
): KeyPress {
  return {
    name,
    sequence: name,
    ctrl: modifiers.ctrl ?? false,
    meta: modifiers.meta ?? false,
    shift: modifiers.shift ?? false,
  };
}

export function char(text: string): KeyPress {
  return { name: null, sequence: text, ctrl: false, meta: false, shift: false };
}
