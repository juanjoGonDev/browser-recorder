/**
 * One key press. Structurally the same as the terminal port's `KeyPress`, kept
 * here so the domain does not depend on a port.
 */
export interface KeyInput {
  /** `null` for printable characters; see `sequence` for those. */
  readonly name: string | null;
  readonly sequence: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
}

const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;

/** The character a key types, or `null` for named and modified keys. */
export function typedCharacter(key: KeyInput): string | null {
  if (key.ctrl || key.meta) return null;
  const codePoint = key.sequence.codePointAt(0);
  const isSingle = Array.from(key.sequence).length === 1;
  if (!isSingle || codePoint === undefined) return null;
  return codePoint >= FIRST_PRINTABLE && codePoint !== DELETE
    ? key.sequence
    : null;
}

/**
 * A lower-case identifier for lookup tables: `ctrl+u`, `return`, `d`.
 * Printable keys use the typed character, so `D` and `d` share an id.
 */
export function keyId(key: KeyInput): string {
  const typed = typedCharacter(key);
  if (typed !== null) return typed.toLowerCase();
  const name = key.name ?? key.sequence;
  return key.ctrl ? `ctrl+${name}` : name;
}
