import type { TextField } from '../domain/app-state.ts';
import { viewField } from '../domain/text-input.ts';
import type { Style } from './ansi.ts';

export interface FieldSpec {
  readonly field: TextField;
  readonly width: number;
  readonly isFocused: boolean;
  /** Muted text shown while an unfocused field is empty. */
  readonly placeholder: string;
}

/** Without color the cursor is a thin bar, so it stays visible under NO_COLOR. */
const PLAIN_CURSOR = '▏';

function withCursor(text: string, cursor: number, style: Style): string {
  const before = text.slice(0, cursor);
  const under = text.slice(cursor, cursor + 1);
  const after = text.slice(cursor + 1);
  if (style.hasColor) return before + style.inverse(under || ' ') + after;
  return before + PLAIN_CURSOR + under + after;
}

/** A single-line input as text: the visible slice, cursor shown when focused. */
export function renderField(spec: FieldSpec, style: Style): string {
  if (!spec.isFocused) {
    return spec.field.value === ''
      ? style.muted(spec.placeholder)
      : viewField(spec.field, spec.width).text;
  }
  const view = viewField(spec.field, spec.width);
  return withCursor(view.text, view.cursor, style);
}
