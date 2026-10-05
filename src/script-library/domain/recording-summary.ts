import type { BrowserChoice } from '../../shared/domain/browser-choice.ts';

/** What the library list shows about one valid recording. */
export interface RecordingSummary {
  readonly slug: string;
  readonly name: string;
  readonly startUrl: string | null;
  readonly createdAt: string;
  readonly durationMs: number;
  readonly stepCount: number;
  /** What the recording ran on; replay launches the same browser. */
  readonly browser: BrowserChoice;
}
