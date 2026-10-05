const MAX_NAME_LENGTH = 80;
// C0 controls and DEL: they break terminals and log lines.
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/** An error message, or `null` when the name is acceptable. */
export function validateName(name: string): string | null {
  if (name.trim() === '') return 'Name is required and cannot be empty.';
  if (name.length > MAX_NAME_LENGTH) {
    return `Name must be at most ${String(MAX_NAME_LENGTH)} characters.`;
  }
  if (CONTROL_CHARACTER.test(name)) {
    return 'Name cannot contain control characters.';
  }
  return null;
}
