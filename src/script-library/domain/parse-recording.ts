import type { Recording, Viewport } from '../../shared/domain/recording.ts';
import type { RecordingEvent } from '../../shared/domain/recording-event.ts';

const SUPPORTED_SCHEMA_VERSION = 1;
const STATUSES: ReadonlySet<unknown> = new Set(['recording', 'complete']);

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

function readViewport(fields: Fields): Viewport {
  const value = fields['viewport'];
  const isViewport =
    isObject(value) &&
    typeof value['width'] === 'number' &&
    typeof value['height'] === 'number';
  if (!isViewport) return fail('viewport', 'an object with width and height');
  return { width: value['width'], height: value['height'] } as Viewport;
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

/** Validates parsed JSON by hand; never touches the file it came from. */
export function parseRecording(raw: unknown): Recording {
  if (!isObject(raw)) return fail('content', 'an object');
  const version = raw['schemaVersion'];
  if (version !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion ${JSON.stringify(version)}; this version reads ${String(SUPPORTED_SCHEMA_VERSION)}.`,
    );
  }
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    name: readString(raw, 'name'),
    slug: readString(raw, 'slug'),
    startUrl: readStartUrl(raw),
    createdAt: readString(raw, 'createdAt'),
    updatedAt: readString(raw, 'updatedAt'),
    status: readStatus(raw),
    durationMs: readNumber(raw, 'durationMs'),
    viewport: readViewport(raw),
    events: readEvents(raw),
  };
}
