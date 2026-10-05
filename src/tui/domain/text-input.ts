import type { TextField } from './app-state.ts';
import type { TextEdit } from './intent.ts';

export interface FieldView {
  readonly text: string;
  /** Cursor index inside `text`. */
  readonly cursor: number;
}

const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;

/** A field with the cursor after `value`. */
export function emptyField(value = ''): TextField {
  return { value, cursor: value.length };
}

function printable(text: string): string {
  return Array.from(text)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= FIRST_PRINTABLE && code !== DELETE;
    })
    .join('');
}

function insert(field: TextField, text: string): TextField {
  const clean = printable(text);
  const value =
    field.value.slice(0, field.cursor) +
    clean +
    field.value.slice(field.cursor);
  return { value, cursor: field.cursor + clean.length };
}

function backspace(field: TextField): TextField {
  if (field.cursor === 0) return field;
  const value =
    field.value.slice(0, field.cursor - 1) + field.value.slice(field.cursor);
  return { value, cursor: field.cursor - 1 };
}

function move(field: TextField, direction: 'left' | 'right'): TextField {
  const next = field.cursor + (direction === 'left' ? -1 : 1);
  return {
    value: field.value,
    cursor: Math.min(Math.max(next, 0), field.value.length),
  };
}

/** Pure single-line editing; the reducer owns where the field lives. */
export function applyEdit(field: TextField, edit: TextEdit): TextField {
  switch (edit.kind) {
    case 'insert':
      return insert(field, edit.text);
    case 'backspace':
      return backspace(field);
    case 'clear-line':
      return emptyField();
    case 'move':
      return move(field, edit.direction);
  }
}

/** The part of the field that fits in `width` cells, cursor included. */
export function viewField(field: TextField, width: number): FieldView {
  const capacity = Math.max(1, width - 1);
  const isAtEnd = field.cursor === field.value.length;
  const start = Math.max(0, field.cursor - capacity + (isAtEnd ? 0 : 1));
  return {
    text: field.value.slice(start, start + capacity),
    cursor: field.cursor - start,
  };
}
