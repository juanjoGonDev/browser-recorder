const GENERATED_PREFIX = /^(?:css|jss|sc|emotion|styled|jsx)-(.+)$/;
const COUNTER_CLASS = /^jss\d+$/;
const MIN_HASH_LENGTH = 5;
const MAX_HASH_LENGTH = 8;

const SPACING = 'p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y';
const SIZING = 'w|h|min-w|max-w|min-h|max-h|basis|aspect';
const LAYOUT =
  'flex|grid|col|row|items|justify|self|place|order|grow|shrink|overflow|object|z|top|left|right|bottom|inset';
const LOOK =
  'text|bg|border|rounded|shadow|font|leading|tracking|opacity|ring|fill|stroke|outline|divide|decoration|cursor';
const MOTION = 'duration|ease|delay|scale|rotate|translate|space-x|space-y';
const UTILITY_PREFIX = `${SPACING}|${SIZING}|${LAYOUT}|${LOOK}|${MOTION}`;
const UTILITY_VALUE = [
  String.raw`\d+(?:\.\d+)?`,
  String.raw`\d+/\d+`,
  String.raw`[a-z]+-\d{2,3}`,
  String.raw`\[.+\]`,
  'px|auto|full|screen|none|2?xs|sm|md|lg|xl|[2-9]xl',
  'center|start|end|between|around|evenly|left|right|justify|baseline|stretch',
  'bold|semibold|medium|light|normal|thin|col|row|wrap|nowrap|top|bottom',
  'hidden|scroll|visible|pointer|x|y',
].join('|');
const UTILITY_CLASS = new RegExp(
  `^-?(?:${UTILITY_PREFIX})-(?:${UTILITY_VALUE})$`,
);
const UTILITY_KEYWORD = new Set([
  'flex',
  'grid',
  'block',
  'inline',
  'inline-block',
  'inline-flex',
  'hidden',
  'relative',
  'absolute',
  'fixed',
  'sticky',
  'static',
  'container',
  'truncate',
  'underline',
  'uppercase',
  'lowercase',
  'capitalize',
  'italic',
  'rounded',
  'border',
  'shadow',
  'transition',
  'visible',
  'invisible',
  'sr-only',
]);
const BOOTSTRAP_DISPLAY =
  /^d-(?:none|inline|inline-block|block|flex|inline-flex|grid)$/;
// Responsive and state variants (`md:flex`, `hover:bg-blue-600`) and arbitrary
// values (`w-[320px]`) only exist in utility-first stylesheets.
const VARIANT_OR_ARBITRARY = /[:[\]]/;

/** A short token that mixes letters with digits, or lower with upper case. */
function looksHashed(token: string): boolean {
  const hasLetter = /[a-z]/i.test(token);
  const hasDigit = /\d/.test(token);
  const hasMixedCase = /[a-z]/.test(token) && /[A-Z]/.test(token);
  return (hasLetter && hasDigit) || hasMixedCase;
}

function isGeneratedPrefix(name: string): boolean {
  const rest = GENERATED_PREFIX.exec(name)?.[1];
  return rest !== undefined && (/^\d+$/.test(rest) || looksHashed(rest));
}

/** CSS-modules style `Button_root__3kF9s`: a short hashed tail after `_`. */
function hasHashedTail(name: string): boolean {
  if (!name.includes('_')) return false;
  const tail = name.split('_').at(-1) ?? '';
  return (
    tail.length >= MIN_HASH_LENGTH &&
    tail.length <= MAX_HASH_LENGTH &&
    looksHashed(tail)
  );
}

function isGeneratedClass(name: string): boolean {
  return (
    COUNTER_CLASS.test(name) || isGeneratedPrefix(name) || hasHashedTail(name)
  );
}

function isUtilityClass(name: string): boolean {
  return (
    UTILITY_KEYWORD.has(name) ||
    UTILITY_CLASS.test(name) ||
    BOOTSTRAP_DISPLAY.test(name) ||
    VARIANT_OR_ARBITRARY.test(name)
  );
}

/**
 * Keeps the class names that describe what an element is, dropping CSS-in-JS
 * hashes and utility classes that change with styling rather than meaning.
 */
export function filterStableClasses(classes: readonly string[]): string[] {
  return classes.filter(
    (name) => !isGeneratedClass(name) && !isUtilityClass(name),
  );
}
