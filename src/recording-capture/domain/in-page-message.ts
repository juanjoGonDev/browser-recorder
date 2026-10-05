import type { Locator } from '../../shared/domain/locator.ts';
import type { CapturedEvent } from './captured-event.ts';

/** The binding the Playwright adapter exposes and the capture script calls. */
export const BINDING_NAME = '__browserRecorderEmit';
/** `Symbol.for` key of the install guard, so a document is wired only once. */
export const INSTALL_FLAG_KEY = 'browser-recorder.installed';
/** `Symbol.for` key of the helpers the adapter calls back into the page. */
export const PAGE_API_KEY = 'browser-recorder.api';

const NAVIGATION_TYPES = [
  'navigate',
  'reload',
  'back_forward',
  'push',
  'replace',
  'traverse',
  'unknown',
] as const;

/** What the capture script hands to the binding, before Node adds context. */
export type InPageMessage =
  | {
      readonly kind: 'dom';
      readonly payload: CapturedEvent;
      readonly candidates: readonly Locator[];
    }
  | {
      readonly kind: 'navigation';
      readonly url: string;
      readonly navigationType: (typeof NAVIGATION_TYPES)[number];
      readonly entryIndex: number | null;
    };

type Fields = Readonly<Record<string, unknown>>;
type Check = (fields: Fields) => boolean;

const MODIFIERS = new Set(['Alt', 'Control', 'Meta', 'Shift']);
const BUTTONS = new Set(['left', 'middle', 'right']);

function isRecord(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): boolean {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isModifierList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && MODIFIERS.has(item))
  );
}

function isCount(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

const LOCATOR_CHECKS: Readonly<Record<string, Check>> = {
  'test-id': (fields) => typeof fields['testId'] === 'string',
  role: (fields) =>
    typeof fields['role'] === 'string' && typeof fields['name'] === 'string',
  label: (fields) => typeof fields['text'] === 'string',
  placeholder: (fields) => typeof fields['text'] === 'string',
  text: (fields) => typeof fields['text'] === 'string',
  css: (fields) => typeof fields['selector'] === 'string',
};

function isLocator(value: unknown): boolean {
  if (!isRecord(value) || typeof value['kind'] !== 'string') return false;
  return Object.hasOwn(LOCATOR_CHECKS, value['kind'])
    ? (LOCATOR_CHECKS[value['kind']]?.(value) ?? false)
    : false;
}

function isLocatorList(value: unknown): boolean {
  return Array.isArray(value) && value.every(isLocator);
}

const PAYLOAD_CHECKS: Readonly<Record<CapturedEvent['kind'], Check>> = {
  click: (fields) =>
    BUTTONS.has(String(fields['button'])) &&
    isModifierList(fields['modifiers']),
  dblclick: (fields) => isModifierList(fields['modifiers']),
  hover: () => true,
  input: (fields) =>
    typeof fields['value'] === 'string' &&
    typeof fields['isSensitive'] === 'boolean',
  select: (fields) => isStringList(fields['values']),
  check: (fields) => typeof fields['checked'] === 'boolean',
  files: (fields) => isStringList(fields['fileNames']),
  key: (fields) => typeof fields['key'] === 'string',
  scroll: (fields) => isCount(fields['x']) && isCount(fields['y']),
  drag: (fields) =>
    isRecord(fields['source']) &&
    isLocatorList(fields['source']['candidates']) &&
    typeof fields['source']['description'] === 'string',
};

function isPayload(value: unknown): boolean {
  if (!isRecord(value) || typeof value['kind'] !== 'string') return false;
  const check = Object.hasOwn(PAYLOAD_CHECKS, value['kind'])
    ? PAYLOAD_CHECKS[value['kind'] as CapturedEvent['kind']]
    : undefined;
  const age = value['ageMs'];
  return (
    check !== undefined &&
    typeof age === 'number' &&
    age >= 0 &&
    Number.isFinite(age) &&
    typeof value['description'] === 'string' &&
    check(value)
  );
}

function isNavigation(fields: Fields): boolean {
  const index = fields['entryIndex'];
  return (
    typeof fields['url'] === 'string' &&
    NAVIGATION_TYPES.some((type) => type === fields['navigationType']) &&
    (index === null || (typeof index === 'number' && Number.isInteger(index)))
  );
}

/**
 * Validates what a page sent to the binding. Page scripts can call the
 * binding too, so nothing from it is trusted: anything malformed is dropped
 * instead of reaching the session.
 */
export function parseInPageMessage(value: unknown): InPageMessage | null {
  if (!isRecord(value)) return null;
  if (value['kind'] === 'navigation') {
    return isNavigation(value) ? (value as unknown as InPageMessage) : null;
  }
  const isValidDom =
    value['kind'] === 'dom' &&
    isPayload(value['payload']) &&
    isLocatorList(value['candidates']);
  return isValidDom ? (value as unknown as InPageMessage) : null;
}
