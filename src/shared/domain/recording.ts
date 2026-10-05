import type { RecordingEvent } from './recording-event.ts';

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** The persisted source of truth for one recorded session. */
export interface Recording {
  readonly schemaVersion: 1;
  readonly name: string;
  readonly slug: string;
  readonly startUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: 'recording' | 'complete';
  readonly durationMs: number;
  readonly viewport: Viewport;
  readonly events: readonly RecordingEvent[];
}
