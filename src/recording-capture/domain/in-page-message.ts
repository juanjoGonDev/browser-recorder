import type { Locator } from '../../shared/domain/locator.ts';
import type { CapturedEvent } from './captured-event.ts';

/** The CDP binding the capture script calls, added to its isolated world only. */
export const BINDING_NAME = '__browserRecorderEmit';
/** `Symbol.for` key of the install guard, so a document is wired only once. */
export const INSTALL_FLAG_KEY = 'browser-recorder.installed';
/** `Symbol.for` key of the helpers Node calls back in the isolated world. */
export const PAGE_API_KEY = 'browser-recorder.api';

/**
 * What the capture script hands to the binding, before Node adds context.
 * Navigation is not reported from the page at all: Node observes it over CDP.
 */
export interface InPageMessage {
  readonly kind: 'dom';
  readonly payload: CapturedEvent;
  readonly candidates: readonly Locator[];
}

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

/**
 * Validates what the capture script sent to the binding. The binding lives in
 * an isolated world the page cannot reach, but nothing crossing the process
 * boundary is trusted: anything malformed is dropped.
 */
export function parseInPageMessage(value: unknown): InPageMessage | null {
  if (!isRecord(value)) return null;
  const isValid =
    value['kind'] === 'dom' &&
    isPayload(value['payload']) &&
    isLocatorList(value['candidates']);
  return isValid ? (value as unknown as InPageMessage) : null;
}

/** The binding delivers one JSON string per message. */
export function parseInPageText(text: string): InPageMessage | null {
  try {
    return parseInPageMessage(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}
