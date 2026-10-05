import type { Modifier } from '../../shared/domain/recording-event.ts';

export interface KeyContext {
  /** The `KeyboardEvent.key` value. */
  readonly key: string;
  readonly modifiers: readonly Modifier[];
  /** The focused element accepts typed text (input, textarea, editable). */
  readonly isInFillable: boolean;
}

const SPECIAL_KEYS = new Set([
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
]);
const FUNCTION_KEY = /^F(?:[1-9]|1[0-2])$/;
// Caret movement inside a text field is part of editing it, not a user action.
const CARET_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);
const EDITING_KEYS = new Set(['Backspace', 'Delete']);
const EDITING_SHORTCUT_KEYS = new Set(['a', 'c', 'v', 'x', 'z', 'y']);
const MODIFIER_KEYS = new Set<string>(['Alt', 'Control', 'Meta', 'Shift']);
const COMMAND_MODIFIERS: readonly Modifier[] = ['Alt', 'Control', 'Meta'];

function isSpecialKey(key: string): boolean {
  return SPECIAL_KEYS.has(key) || FUNCTION_KEY.test(key);
}

function isShortcut(context: KeyContext): boolean {
  return (
    !MODIFIER_KEYS.has(context.key) &&
    context.modifiers.some((modifier) => COMMAND_MODIFIERS.includes(modifier))
  );
}

function isEditingShortcut(context: KeyContext): boolean {
  const hasEditModifier =
    context.modifiers.includes('Control') || context.modifiers.includes('Meta');
  return (
    hasEditModifier && EDITING_SHORTCUT_KEYS.has(context.key.toLowerCase())
  );
}

function isEditingKey(context: KeyContext): boolean {
  return (
    EDITING_KEYS.has(context.key) ||
    CARET_KEYS.has(context.key) ||
    isEditingShortcut(context)
  );
}

/**
 * Whether a key press is a user action worth recording. Typed characters are
 * captured through input events instead, so only special keys and command
 * shortcuts count, and inside a text field editing keys are left out.
 */
export function shouldRecordKey(context: KeyContext): boolean {
  if (context.isInFillable && isEditingKey(context)) return false;
  return isSpecialKey(context.key) || isShortcut(context);
}
