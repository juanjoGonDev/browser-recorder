import type { Recording } from '../../../shared/domain/recording.ts';

/** Where the session persists its latest snapshot (debounced by the session). */
export interface RecordingSink {
  save(recording: Recording): Promise<void>;
}
