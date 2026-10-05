import {
  BUNDLED_EPHEMERAL,
  type BrowserChoice,
  type BrowserId,
  type ProfileMode,
} from '../../shared/domain/browser-choice.ts';
import type { Display, Recording } from '../../shared/domain/recording.ts';
import type { RecordingEvent } from '../../shared/domain/recording-event.ts';

const LEGACY_SCHEMA_VERSION = 1;
const CURRENT_SCHEMA_VERSION = 2;
const STATUSES: ReadonlySet<unknown> = new Set(['recording', 'complete']);
const DISPLAY_KINDS: ReadonlySet<unknown> = new Set(['window', 'emulated']);
const PROFILE_MODES: ReadonlySet<unknown> = new Set([
  'managed',
  'copy-of-real',
  'ephemeral',
]);

type Fields = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(field: string, expected: string): never {
  throw new Error(`Invalid recording: ${field} must be ${expected}.`);
}

function readString(fields: Fields, field: string): string {
  const value = fields[field];
  return typeof value === 'string' ? value : fail(field, 'a string');
}

function readNumber(fields: Fields, field: string): number {
  const value = fields[field];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fail(field, 'a number');
}

function readStartUrl(fields: Fields): string | null {
  const value = fields['startUrl'];
  if (value === null || typeof value === 'string') return value;
  return fail('startUrl', 'a string or null');
}

function readSize(
  value: unknown,
  field: string,
): { width: number; height: number } {
  const size = isObject(value) ? value : {};
  const { width, height } = size as { width?: unknown; height?: unknown };
  if (typeof width !== 'number' || typeof height !== 'number') {
    return fail(field, 'an object with width and height');
  }
  return { width, height };
}

function readDisplay(fields: Fields): Display {
  const value = fields['display'];
  if (!isObject(value) || !DISPLAY_KINDS.has(value['kind'])) {
    return fail('display', "an object with kind 'window' or 'emulated'");
  }
  return {
    kind: value['kind'] as Display['kind'],
    ...readSize(value, 'display'),
  };
}

/**
 * The id stays a plain string on purpose: a file edited to name a browser this
 * version does not know must still load, and replay falls back to the bundled
 * one instead of refusing the recording.
 */
function readBrowser(fields: Fields): BrowserChoice {
  const value = fields['browser'];
  const isChoice =
    isObject(value) &&
    typeof value['browserId'] === 'string' &&
    PROFILE_MODES.has(value['profileMode']) &&
    (value['sourceProfile'] === null ||
      typeof value['sourceProfile'] === 'string');
  if (!isChoice) {
    return fail(
      'browser',
      'an object with a browserId, a profileMode (managed, copy-of-real or ephemeral) and a sourceProfile',
    );
  }
  return {
    browserId: value['browserId'] as BrowserId,
    profileMode: value['profileMode'] as ProfileMode,
    sourceProfile: value['sourceProfile'] as string | null,
  };
}

/** Version 1 pinned emulated metrics and never named a browser. */
function readLegacyBrowserFields(
  fields: Fields,
): Pick<Recording, 'display' | 'browser'> {
  return {
    display: {
      kind: 'emulated',
      ...readSize(fields['viewport'], 'viewport'),
    },
    browser: BUNDLED_EPHEMERAL,
  };
}

function readBrowserFields(
  fields: Fields,
  version: unknown,
): Pick<Recording, 'display' | 'browser'> {
  return version === LEGACY_SCHEMA_VERSION
    ? readLegacyBrowserFields(fields)
    : { display: readDisplay(fields), browser: readBrowser(fields) };
}

function readEvents(fields: Fields): readonly RecordingEvent[] {
  const value = fields['events'];
  if (!Array.isArray(value)) return fail('events', 'an array');
  const events = value as readonly unknown[];
  events.forEach((event, index) => {
    const isEvent =
      isObject(event) &&
      typeof event['kind'] === 'string' &&
      typeof event['offsetMs'] === 'number' &&
      typeof event['pageId'] === 'string';
    if (!isEvent)
      fail(
        `events[${String(index)}]`,
        'an event with kind, offsetMs and pageId',
      );
  });
  return events as readonly RecordingEvent[];
}

function readStatus(fields: Fields): Recording['status'] {
  const value = fields['status'];
  return STATUSES.has(value)
    ? (value as Recording['status'])
    : fail('status', "'recording' or 'complete'");
}

/**
 * Validates parsed JSON by hand; never touches the file it came from. A
 * version 1 file reads as the current version without being rewritten.
 */
export function parseRecording(raw: unknown): Recording {
  if (!isObject(raw)) return fail('content', 'an object');
  const version = raw['schemaVersion'];
  if (version !== LEGACY_SCHEMA_VERSION && version !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion ${JSON.stringify(version)}; this version reads ${String(LEGACY_SCHEMA_VERSION)} and ${String(CURRENT_SCHEMA_VERSION)}.`,
    );
  }
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: readString(raw, 'name'),
    slug: readString(raw, 'slug'),
    startUrl: readStartUrl(raw),
    createdAt: readString(raw, 'createdAt'),
    updatedAt: readString(raw, 'updatedAt'),
    status: readStatus(raw),
    durationMs: readNumber(raw, 'durationMs'),
    ...readBrowserFields(raw, version),
    events: readEvents(raw),
  };
}
