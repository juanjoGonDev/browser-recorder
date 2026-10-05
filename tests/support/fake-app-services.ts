import type { BrowserChoice } from '../../src/shared/domain/browser-choice.ts';
import type { Recording } from '../../src/shared/domain/recording.ts';
import type {
  AppServices,
  NewRecordingRequest,
} from '../../src/tui/application/ports/app-services.ts';
import type {
  BrowserOptionView,
  EnvironmentView,
  LibraryEntryView,
  LiveRecordingView,
  LiveReplayView,
  RecordingUpdateView,
  ReplayView,
} from '../../src/tui/domain/app-views.ts';
import { validateName } from '../../src/script-library/domain/validate-name.ts';
import { validateStartUrl } from '../../src/script-library/domain/validate-start-url.ts';
import { BROWSER_VIEWS, recordingWith, clicks } from './tui-fixtures.ts';

export class FakeLiveRecording implements LiveRecordingView {
  readonly warnings: readonly string[] = [];
  readonly responses: {
    action: 'accept' | 'dismiss';
    promptText: string | null;
  }[] = [];
  stopCount = 0;
  discardCount = 0;
  unsubscribeCount = 0;
  private readonly listeners: ((update: RecordingUpdateView) => void)[] = [];

  subscribe(listener: (update: RecordingUpdateView) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.unsubscribeCount += 1;
    };
  }

  emit(update: RecordingUpdateView): void {
    for (const listener of this.listeners) listener(update);
  }

  respondToDialog(response: {
    readonly action: 'accept' | 'dismiss';
    readonly promptText: string | null;
  }): Promise<void> {
    this.responses.push({ ...response });
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.stopCount += 1;
    return Promise.resolve();
  }

  discard(): Promise<void> {
    this.discardCount += 1;
    return Promise.resolve();
  }
}

export class FakeLiveReplay implements LiveReplayView {
  readonly warnings: readonly string[] = [];
  cancelCount = 0;
  readonly finished: Promise<ReplayView>;
  private readonly listeners: ((view: ReplayView) => void)[] = [];
  private finish: (view: ReplayView) => void = () => undefined;

  constructor() {
    this.finished = new Promise((resolve) => {
      this.finish = resolve;
    });
  }

  subscribe(listener: (view: ReplayView) => void): () => void {
    this.listeners.push(listener);
    return () => undefined;
  }

  emit(view: ReplayView): void {
    for (const listener of this.listeners) listener(view);
  }

  resolveFinished(view: ReplayView): void {
    this.finish(view);
  }

  cancel(): Promise<void> {
    this.cancelCount += 1;
    return Promise.resolve();
  }
}

export interface FakeServicesHandle {
  readonly services: AppServices;
  readonly live: FakeLiveRecording;
  readonly replay: FakeLiveReplay;
  readonly startRequests: (NewRecordingRequest & {
    readonly browser: BrowserChoice;
  })[];
  readonly removed: string[];
  readonly renamed: { slug: string; name: string }[];
  readonly replayed: string[];
  entries: LibraryEntryView[];
  browsers: readonly BrowserOptionView[];
  environment: (onLine: (line: string) => void) => Promise<EnvironmentView>;
  renameError: Error | null;
  removeError: Error | null;
  startError: Error | null;
  /** Makes `browsers.list()` reject, as when detection fails. */
  browsersError: Error | null;
  /** While set, `browsers.list()` waits for it: detection in progress. */
  browsersGate: Promise<void> | null;
  listCount: number;
}

/** Fake `AppServices` using the real validators, with everything observable. */
export function createFakeServices(): FakeServicesHandle {
  const live = new FakeLiveRecording();
  const replay = new FakeLiveReplay();
  const handle: FakeServicesHandle = {
    live,
    replay,
    startRequests: [],
    removed: [],
    renamed: [],
    replayed: [],
    entries: [],
    browsers: BROWSER_VIEWS,
    environment: () =>
      Promise.resolve({ kind: 'ready', linuxHint: null, browsers: [] }),
    renameError: null,
    removeError: null,
    startError: null,
    browsersError: null,
    browsersGate: null,
    listCount: 0,
    services: {
      environment: {
        ensureBrowser: (onLine) => handle.environment(onLine),
      },
      library: {
        list: () => {
          handle.listCount += 1;
          return Promise.resolve([...handle.entries]);
        },
        load: (): Promise<Recording> =>
          Promise.resolve(recordingWith(clicks(3))),
        validateName,
        validateStartUrl,
        rename: (slug, name) => {
          if (handle.renameError !== null) {
            return Promise.reject(handle.renameError);
          }
          handle.renamed.push({ slug, name });
          return Promise.resolve();
        },
        remove: (slug) => {
          if (handle.removeError !== null) {
            return Promise.reject(handle.removeError);
          }
          handle.removed.push(slug);
          return Promise.resolve();
        },
      },
      browsers: {
        list: async () => {
          await handle.browsersGate;
          if (handle.browsersError !== null) throw handle.browsersError;
          return handle.browsers;
        },
      },
      recording: {
        start: (request) => {
          handle.startRequests.push(request);
          if (handle.startError !== null) {
            return Promise.reject(handle.startError);
          }
          return Promise.resolve(live);
        },
      },
      replay: {
        start: (slug) => {
          handle.replayed.push(slug);
          return Promise.resolve(replay);
        },
      },
    },
  };
  return handle;
}
