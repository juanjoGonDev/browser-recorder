import type { BrowserChoice } from './browser-choice.ts';
import type { RecordingEvent } from './recording-event.ts';

/**
 * The size the page was recorded at. A `window` is a real browser window whose
 * viewport follows the browser chrome; `emulated` pins fixed viewport metrics
 * (what schema version 1 recordings used).
 */
export interface Display {
  readonly kind: 'window' | 'emulated';
  readonly width: number;
  readonly height: number;
}

/** The persisted source of truth for one recorded session. */
export interface Recording {
  readonly schemaVersion: 2;
  readonly name: string;
  readonly slug: string;
  readonly startUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: 'recording' | 'complete';
  readonly durationMs: number;
  readonly display: Display;
  readonly browser: BrowserChoice;
  readonly events: readonly RecordingEvent[];
}
