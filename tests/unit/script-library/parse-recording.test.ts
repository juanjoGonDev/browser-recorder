import { describe, expect, it } from 'vitest';

import { parseRecording } from '../../../src/script-library/domain/parse-recording.ts';
import { BASIC_RECORDING } from '../../support/golden-recordings.ts';

function roundTrip(): unknown {
  return JSON.parse(JSON.stringify(BASIC_RECORDING));
}

function withField(field: string, value: unknown): unknown {
  return { ...(roundTrip() as Record<string, unknown>), [field]: value };
}

describe('parseRecording', () => {
  it('returns a valid recording unchanged', () => {
    expect(parseRecording(roundTrip())).toEqual(BASIC_RECORDING);
  });

  it('names an unsupported schema version', () => {
    expect(() => parseRecording(withField('schemaVersion', 2))).toThrow(
      /unsupported schemaVersion 2/i,
    );
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
    ['viewport', { width: 1 }],
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
