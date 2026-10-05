import type { Recording } from '../../../shared/domain/recording.ts';
import type {
  EnvironmentView,
  LibraryEntryView,
  LiveRecordingView,
  LiveReplayView,
} from '../../domain/app-views.ts';

export interface NewRecordingRequest {
  readonly name: string;
  readonly startUrl: string | null;
}

/**
 * Everything the TUI may ask of the application. Implemented only in
 * `src/composition/create-app-services.ts`; tests use fakes. Methods reject
 * with an `Error` whose message is safe to show inline (for example a rename
 * conflict).
 */
export interface AppServices {
  readonly environment: {
    /** Checks Chromium, installing it when missing; streams installer lines. */
    ensureBrowser(onLine: (line: string) => void): Promise<EnvironmentView>;
  };
  readonly library: {
    list(): Promise<readonly LibraryEntryView[]>;
    load(slug: string): Promise<Recording>;
    /** An error message, or `null` when the name is acceptable. */
    validateName(name: string): string | null;
    /** An error message, or `null` when the URL is empty or http/https. */
    validateStartUrl(startUrl: string): string | null;
    rename(slug: string, name: string): Promise<void>;
    remove(slug: string): Promise<void>;
  };
  readonly recording: {
    start(request: NewRecordingRequest): Promise<LiveRecordingView>;
  };
  readonly replay: {
    start(slug: string): Promise<LiveReplayView>;
  };
}
