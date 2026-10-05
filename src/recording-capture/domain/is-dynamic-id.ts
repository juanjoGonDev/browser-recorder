const MIN_DIGIT_RUN = 4;
const MIN_HEX_RUN = 8;

const DIGIT_RUN = new RegExp(`\\d{${String(MIN_DIGIT_RUN)},}`);
// Covers uuids and content hashes alike: no human-written id has this much hex.
const HEX_RUN = new RegExp(`[0-9a-f]{${String(MIN_HEX_RUN)},}`, 'i');
// React `useId` output such as `:r1:`, also inside Radix and Headless UI ids.
const REACT_USE_ID = /:r[0-9a-z]*:/i;
const GENERATED_PREFIX = /^(?:radix-|headlessui-|mui-)/;
const EMBER_VIEW_ID = /^ember\d/;

const DYNAMIC_PATTERNS: readonly RegExp[] = [
  DIGIT_RUN,
  HEX_RUN,
  REACT_USE_ID,
  GENERATED_PREFIX,
  EMBER_VIEW_ID,
];

/**
 * True when an element id looks generated at runtime, so it would not survive
 * a reload and must not be used as a locator.
 */
export function isDynamicId(id: string): boolean {
  return DYNAMIC_PATTERNS.some((pattern) => pattern.test(id));
}
