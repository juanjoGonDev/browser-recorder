import { describe, expect, it } from 'vitest';
import type { KeyContext } from '../../../src/recording-capture/domain/should-record-key.ts';
import { shouldRecordKey } from '../../../src/recording-capture/domain/should-record-key.ts';

function press(
  key: string,
  options: Partial<Omit<KeyContext, 'key'>> = {},
): boolean {
  return shouldRecordKey({
    key,
    modifiers: options.modifiers ?? [],
    isInFillable: options.isInFillable ?? false,
  });
}

describe('src/recording-capture/domain/should-record-key.ts', () => {
  describe('outside a fillable element', () => {
    it.each([
      'Enter',
      'Tab',
      'Escape',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'F1',
      'F12',
    ])('records the special key %s', (key) => {
      expect(press(key)).toBe(true);
    });

    it.each([
      [['Control'], 'k'],
      [['Meta'], 'k'],
      [['Alt'], 'ArrowLeft'],
      [['Control', 'Shift'], 'K'],
      [['Control'], 'a'],
    ] as const)('records the shortcut %j + %s', (modifiers, key) => {
      expect(press(key, { modifiers })).toBe(true);
    });

    it.each(['a', 'Z', '7', ' ', 'Backspace', 'Delete', 'Unidentified'])(
      'ignores the plain key %j',
      (key) => {
        expect(press(key)).toBe(false);
      },
    );

    it('ignores Shift alone with a character, which is only typing', () => {
      expect(press('A', { modifiers: ['Shift'] })).toBe(false);
    });

    it('records Shift+Tab because Tab is special', () => {
      expect(press('Tab', { modifiers: ['Shift'] })).toBe(true);
    });

    it.each(['Control', 'Shift', 'Alt', 'Meta'])(
      'ignores the bare modifier %s',
      (key) => {
        expect(press(key, { modifiers: [key as 'Shift'] })).toBe(false);
      },
    );
  });

  describe('inside a fillable element', () => {
    it.each(['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'F5'])(
      'keeps %s',
      (key) => {
        expect(press(key, { isInFillable: true })).toBe(true);
      },
    );

    it.each([
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ])('skips the editing key %s', (key) => {
      expect(press(key, { isInFillable: true })).toBe(false);
    });

    it.each(['a', 'c', 'v', 'x', 'z', 'y', 'A'])(
      'skips Control+%s and Meta+%s as editing shortcuts',
      (key) => {
        expect(press(key, { isInFillable: true, modifiers: ['Control'] })).toBe(
          false,
        );
        expect(press(key, { isInFillable: true, modifiers: ['Meta'] })).toBe(
          false,
        );
      },
    );

    it('keeps other shortcuts such as Control+K and Control+Enter', () => {
      expect(press('k', { isInFillable: true, modifiers: ['Control'] })).toBe(
        true,
      );
      expect(
        press('Enter', { isInFillable: true, modifiers: ['Control'] }),
      ).toBe(true);
    });

    it('still skips plain typing', () => {
      expect(press('a', { isInFillable: true })).toBe(false);
    });
  });
});
