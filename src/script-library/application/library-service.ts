import type { Recording } from '../../shared/domain/recording.ts';
import type {
  RecordingListing,
  RecordingRepository,
} from './ports/recording-repository.ts';

export interface LibraryServiceDeps {
  readonly repository: RecordingRepository;
  readonly renderScript: (recording: Recording) => string;
  readonly now: () => Date;
}

export interface LibraryService {
  createDraft(name: string, startUrl: string | null): Promise<Recording>;
  /** Newest first; a corrupt entry is listed as `invalid`, never thrown. */
  list(): Promise<readonly RecordingListing[]>;
  load(slug: string): Promise<Recording>;
  /** Writes `recording.json` and the regenerated `script.mjs` atomically. */
  save(recording: Recording): Promise<void>;
  rename(slug: string, name: string): Promise<Recording>;
  remove(slug: string): Promise<void>;
}

// Frozen signature: work package WP4 replaces this declaration with the
// implementation.
export declare function createLibraryService(
  deps: LibraryServiceDeps,
): LibraryService;
