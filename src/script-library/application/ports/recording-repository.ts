import type { RecordingSummary } from '../../domain/recording-summary.ts';

export type RecordingListing =
  | { readonly kind: 'valid'; readonly summary: RecordingSummary }
  | {
      readonly kind: 'invalid';
      readonly slug: string;
      readonly reason: string;
    };

export interface RecordingFiles {
  readonly recordingJson: string;
  readonly scriptMjs: string;
}

/** Slug-addressed storage; every method treats the slug as one path segment. */
export interface RecordingRepository {
  listSlugs(): Promise<readonly string[]>;
  /** Claims the slug; `false` when it already exists. */
  reserve(slug: string): Promise<boolean>;
  /** The parsed-but-unvalidated content of `recording.json`. */
  read(slug: string): Promise<unknown>;
  write(slug: string, files: RecordingFiles): Promise<void>;
  /** Fails when the target slug already exists. */
  move(from: string, to: string): Promise<void>;
  remove(slug: string): Promise<void>;
  scriptPath(slug: string): string;
}
