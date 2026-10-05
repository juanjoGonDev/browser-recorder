const MODIFIER_ORDER = ['Control', 'Alt', 'Shift', 'Meta'] as const;

const MODIFIER_ALIASES: Readonly<Record<string, string>> = {
  control: 'Control',
  ctrl: 'Control',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
};

const SPACE_KEY = 'Space';
const SEPARATOR = '+';

/** Splits on `+` while keeping a trailing `+` as the pressed key. */
function splitCombination(combination: string): string[] {
  if (combination === SEPARATOR) return [SEPARATOR];
  if (!combination.endsWith(SEPARATOR)) return combination.split(SEPARATOR);
  const modifiers = combination.slice(0, -2).split(SEPARATOR);
  return [...modifiers, SEPARATOR];
}

function canonicalKey(key: string, hasShift: boolean): string {
  if (key === ' ') return SPACE_KEY;
  const isLetter = key.length === 1 && key.toLowerCase() !== key.toUpperCase();
  return isLetter && hasShift ? key.toUpperCase() : key;
}

/**
 * Canonical key combination: modifiers in the fixed order Control, Alt,
 * Shift, Meta (aliases resolved, duplicates dropped), then the key.
 */
export function normalizeKey(combination: string): string {
  const parts = splitCombination(combination);
  const key = parts[parts.length - 1] ?? '';
  const named = new Set(
    parts
      .slice(0, -1)
      .map((part) => MODIFIER_ALIASES[part.toLowerCase()] ?? part),
  );
  const modifiers = MODIFIER_ORDER.filter((modifier) => named.has(modifier));
  const finalKey = canonicalKey(key, named.has('Shift'));
  return [...modifiers, finalKey].join(SEPARATOR);
}
