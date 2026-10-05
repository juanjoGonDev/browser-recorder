import { describe, expect, it } from 'vitest';

import { summarizeRecording } from '../../../src/script-library/domain/summarize-recording.ts';
import {
  BRAVE_CHOICE,
  BUNDLED_CHOICE,
} from '../../support/browser-fixtures.ts';
import {
  BASIC_RECORDING,
  recordingOf,
} from '../../support/golden-recordings.ts';

describe('summarizeRecording', () => {
  it('copies the listing fields and counts events as steps', () => {
    expect(summarizeRecording(BASIC_RECORDING)).toEqual({
      slug: 'golden',
      name: 'Golden',
      startUrl: 'https://example.com/',
      createdAt: '2026-01-01T00:00:00.000Z',
      durationMs: 9000,
      stepCount: BASIC_RECORDING.events.length,
      browser: BUNDLED_CHOICE,
    });
  });

  it('keeps the browser the recording ran on', () => {
    const recording = recordingOf([], { browser: BRAVE_CHOICE });
    expect(summarizeRecording(recording).browser).toEqual(BRAVE_CHOICE);
  });

  it('reports zero steps for an empty draft', () => {
    expect(
      summarizeRecording(recordingOf([], { startUrl: null })).stepCount,
    ).toBe(0);
  });
});
