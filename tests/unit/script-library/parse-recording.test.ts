import { describe, expect, it } from 'vitest';

import { parseRecording } from '../../../src/script-library/domain/parse-recording.ts';
import { BASIC_RECORDING } from '../../support/golden-recordings.ts';

const LEGACY_VIEWPORT = { width: 800, height: 600 };

function roundTrip(): unknown {
  return JSON.parse(JSON.stringify(BASIC_RECORDING));
}

function withField(field: string, value: unknown): unknown {
  return { ...(roundTrip() as Record<string, unknown>), [field]: value };
}

function withoutFields(...fields: string[]): Record<string, unknown> {
  const copy = { ...(roundTrip() as Record<string, unknown>) };
  for (const field of fields) Reflect.deleteProperty(copy, field);
  return copy;
}

/** What a schema version 1 `recording.json` looked like before browsers. */
function legacyFile(): Record<string, unknown> {
  return {
    ...withoutFields('display', 'browser'),
    schemaVersion: 1,
    viewport: LEGACY_VIEWPORT,
  };
}

describe('parseRecording', () => {
  it('returns a valid recording unchanged', () => {
    expect(parseRecording(roundTrip())).toEqual(BASIC_RECORDING);
  });

  it('names an unsupported schema version', () => {
    expect(() => parseRecording(withField('schemaVersion', 3))).toThrow(
      /unsupported schemaVersion 3/i,
    );
  });

  it('keeps a recorded browser, mode and source profile', () => {
    const browser = {
      browserId: 'brave',
      profileMode: 'copy-of-real',
      sourceProfile: 'Profile 2',
    };
    expect(parseRecording(withField('browser', browser)).browser).toEqual(
      browser,
    );
  });

  it('reads a version 1 file as an emulated display on the bundled browser', () => {
    expect(parseRecording(legacyFile())).toEqual({
      ...BASIC_RECORDING,
      display: { kind: 'emulated', ...LEGACY_VIEWPORT },
      browser: {
        browserId: 'bundled',
        profileMode: 'ephemeral',
        sourceProfile: null,
      },
    });
  });

  it('does not change the object it was given while migrating', () => {
    const file = legacyFile();
    const before = structuredClone(file);
    parseRecording(file);
    expect(file).toEqual(before);
  });

  it('requires the display and the browser in a version 2 file', () => {
    expect(() => parseRecording(withoutFields('display'))).toThrow(/display/);
    expect(() => parseRecording(withoutFields('browser'))).toThrow(/browser/);
  });

  it('rejects content that is not an object', () => {
    expect(() => parseRecording(null)).toThrow(/object/);
    expect(() => parseRecording([])).toThrow(/object/);
    expect(() => parseRecording('x')).toThrow(/object/);
  });

  it.each([
    ['name', 5],
    ['slug', null],
    ['createdAt', 1],
    ['durationMs', 'long'],
    ['status', 'half'],
    ['startUrl', 3],
    ['display', { kind: 'window', width: 1 }],
    ['display', { kind: 'huge', width: 1, height: 1 }],
    [
      'browser',
      { browserId: 'brave', profileMode: 'shared', sourceProfile: null },
    ],
    ['browser', { browserId: 7, profileMode: 'managed', sourceProfile: null }],
    [
      'browser',
      { browserId: 'brave', profileMode: 'managed', sourceProfile: 3 },
    ],
    ['events', {}],
  ])('rejects a bad %s', (field, value) => {
    expect(() => parseRecording(withField(field, value))).toThrow(
      new RegExp(field),
    );
  });

  it('accepts a null start URL', () => {
    expect(parseRecording(withField('startUrl', null)).startUrl).toBeNull();
  });

  it('rejects an event without a kind or offset', () => {
    expect(() =>
      parseRecording(withField('events', [{ kind: 'click' }])),
    ).toThrow(/events\[0\]/);
    expect(() =>
      parseRecording(withField('events', [{ offsetMs: 1 }])),
    ).toThrow(/events\[0\]/);
  });
});
