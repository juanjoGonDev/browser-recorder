import { describe, expect, it } from 'vitest';
import { normalizeKey } from '../../../src/recording-capture/domain/normalize-key.ts';

describe('src/recording-capture/domain/normalize-key.ts', () => {
  it('keeps an already canonical combination', () => {
    expect(normalizeKey('Control+Shift+K')).toBe('Control+Shift+K');
  });

  it.each([
    ['Shift+Control+K', 'Control+Shift+K'],
    ['Meta+Alt+Shift+Control+x', 'Control+Alt+Shift+Meta+X'],
    ['Shift+Alt+Tab', 'Alt+Shift+Tab'],
  ])('orders the modifiers of %s', (input, expected) => {
    expect(normalizeKey(input)).toBe(expected);
  });

  it.each([
    ['ctrl+a', 'Control+a'],
    ['Cmd+Option+Z', 'Alt+Meta+Z'],
    ['command+k', 'Meta+k'],
    ['control+shift+k', 'Control+Shift+K'],
  ])('maps the alias spelling of %s', (input, expected) => {
    expect(normalizeKey(input)).toBe(expected);
  });

  it('drops a repeated modifier', () => {
    expect(normalizeKey('Control+Control+a')).toBe('Control+a');
  });

  it('leaves a lone key and a lone modifier untouched', () => {
    expect(normalizeKey('Enter')).toBe('Enter');
    expect(normalizeKey('Shift')).toBe('Shift');
  });

  it('keeps a plus sign pressed as the key', () => {
    expect(normalizeKey('Control++')).toBe('Control++');
    expect(normalizeKey('+')).toBe('+');
  });

  it('names the space bar so the combination stays readable', () => {
    expect(normalizeKey('Control+ ')).toBe('Control+Space');
    expect(normalizeKey(' ')).toBe('Space');
  });
});
