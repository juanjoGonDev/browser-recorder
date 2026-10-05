import type { Recording } from '../../shared/domain/recording.ts';
import type { RecordingSummary } from './recording-summary.ts';

export function summarizeRecording(recording: Recording): RecordingSummary {
  return {
    slug: recording.slug,
    name: recording.name,
    startUrl: recording.startUrl,
    createdAt: recording.createdAt,
    durationMs: recording.durationMs,
    stepCount: recording.events.length,
  };
}
