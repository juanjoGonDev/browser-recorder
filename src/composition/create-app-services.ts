import type { BrowserInstallation } from '../environment-setup/application/ports/browser-installation.ts';
import { ensureBrowser } from '../environment-setup/application/ensure-browser.ts';
import { linuxDepsHint } from '../environment-setup/domain/linux-deps-hint.ts';
import type {
  BrowserLauncher,
  LaunchTarget,
} from '../recording-capture/application/ports/browser-launcher.ts';
import type { MonotonicClock } from '../recording-capture/application/ports/monotonic-clock.ts';
import { startRecording } from '../recording-capture/application/recording-session.ts';
import type {
  LiveRecording,
  StartRecordingRequest,
} from '../recording-capture/application/recording-session.ts';
import { startReplay } from '../replay/application/replay-runner.ts';
import type { ProcessSpawner } from '../replay/application/ports/process-spawner.ts';
import type { Recording } from '../shared/domain/recording.ts';
import type { LibraryService } from '../script-library/application/library-service.ts';
import { validateName } from '../script-library/domain/validate-name.ts';
import { validateStartUrl } from '../script-library/domain/validate-start-url.ts';
import {
  BUNDLED_EPHEMERAL,
  type BrowserChoice,
} from '../shared/domain/browser-choice.ts';
import type { AppServices } from '../tui/application/ports/app-services.ts';
import type {
  BrowserOptionView,
  EnvironmentView,
  LibraryEntryView,
} from '../tui/domain/app-views.ts';
import { toLiveRecordingView } from './recording-views.ts';
import { toLiveReplayView } from './replay-views.ts';

export interface ReplayDeps {
  readonly spawner: ProcessSpawner;
  readonly nodePath: string;
  readonly cancelGraceMs: number;
  /** The package root: the generated script resolves `playwright` from it. */
  readonly cwd: string;
  readonly scriptPathOf: (slug: string) => string;
}

export interface AppServicesDeps {
  readonly library: LibraryService;
  readonly launcher: BrowserLauncher;
  readonly clock: MonotonicClock;
  readonly now: () => Date;
  readonly installation: BrowserInstallation;
  /** `process.platform`, injected so the Linux hint is testable. */
  readonly platform: string;
  /** Opens no browser window (tests, automation). */
  readonly isHeadless: boolean;
  readonly replay: ReplayDeps;
}

/** `AppServices` plus what the entry point needs when the process is cut short. */
export interface ComposedServices extends AppServices {
  /** Saves and closes the live recording, if any; never rejects. */
  persistActiveRecording(): Promise<void>;
}

/**
 * Until the launch planner exists, every recording runs on the bundled browser
 * and the launcher ignores the target; this only fills the required field.
 */
const UNPLANNED_TARGET: LaunchTarget = {
  executablePath: null,
  userDataDir: '',
  browserArgs: [],
  shouldUseRealKeychain: false,
};
const BUNDLED_BROWSER_VIEW: BrowserOptionView = {
  browserId: 'bundled',
  label: 'Chromium (bundled)',
  profiles: [
    {
      choice: BUNDLED_EPHEMERAL,
      label: 'Ephemeral (clean each time)',
      note: null,
    },
  ],
};

const INSTALLING_MESSAGE =
  'Chromium is not installed yet; installing it now (one time, about 150 MB)...';

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toEntryView(
  listing: Awaited<ReturnType<LibraryService['list']>>[number],
): LibraryEntryView {
  if (listing.kind === 'invalid') return listing;
  const { slug, name, createdAt, durationMs, stepCount } = listing.summary;
  return { kind: 'valid', slug, name, createdAt, durationMs, stepCount };
}

function sessionRequest(
  draft: Recording,
  browser: BrowserChoice,
): StartRecordingRequest {
  return {
    name: draft.name,
    slug: draft.slug,
    startUrl: draft.startUrl,
    browser,
    target: UNPLANNED_TARGET,
  };
}

/** Adapts every feature use case to what the TUI asks of `AppServices`. */
export function createAppServices(deps: AppServicesDeps): ComposedServices {
  return new Composition(deps).services();
}

class Composition {
  private readonly deps: AppServicesDeps;
  private active: LiveRecording | null = null;

  constructor(deps: AppServicesDeps) {
    this.deps = deps;
  }

  services(): ComposedServices {
    const { library } = this.deps;
    return {
      environment: {
        ensureBrowser: (onLine) => this.ensureBrowser(onLine),
      },
      library: {
        list: async () => (await library.list()).map(toEntryView),
        load: (slug) => library.load(slug),
        validateName,
        validateStartUrl,
        rename: async (slug, name) => {
          await library.rename(slug, name);
        },
        remove: (slug) => library.remove(slug),
      },
      browsers: { list: () => Promise.resolve([BUNDLED_BROWSER_VIEW]) },
      recording: {
        start: (request) => this.startRecording(request),
      },
      replay: { start: (slug) => this.startReplay(slug) },
      persistActiveRecording: () => this.persistActiveRecording(),
    };
  }

  private ensureBrowser(
    onLine: (line: string) => void,
  ): Promise<EnvironmentView> {
    return ensureBrowser({
      installation: this.deps.installation,
      platform: this.deps.platform,
      onEvent: (event) => {
        onLine(event.kind === 'missing' ? INSTALLING_MESSAGE : event.line);
      },
    }).then((result) =>
      result.kind === 'ready' ? { ...result, browsers: [] } : result,
    );
  }

  private async startRecording(request: {
    readonly name: string;
    readonly startUrl: string | null;
    readonly browser: BrowserChoice;
  }) {
    const { library, launcher, clock, now, isHeadless } = this.deps;
    const draft = await library.createDraft(request.name, request.startUrl);
    let live: LiveRecording;
    try {
      live = await startRecording(
        {
          launcher,
          clock,
          now,
          isHeadless,
          sink: { save: (recording) => library.save(recording) },
        },
        sessionRequest(draft, request.browser),
      );
    } catch (error) {
      await library.remove(draft.slug).catch(() => undefined);
      throw new Error(this.explainLaunchFailure(describe(error)));
    }
    this.active = live;
    live.subscribe((update) => {
      if (update.isClosed && this.active === live) this.active = null;
    });
    return toLiveRecordingView(live, {
      stop: async () => {
        await live.stop();
      },
      discard: async () => {
        await live.discard();
        await library.remove(draft.slug);
      },
    });
  }

  private explainLaunchFailure(message: string): string {
    const hint = linuxDepsHint(this.deps.platform, message);
    return hint === null ? message : `${message}\n${hint}`;
  }

  private async startReplay(slug: string) {
    const { library, replay, isHeadless } = this.deps;
    const recording = await library.load(slug);
    const live = startReplay(
      {
        spawner: replay.spawner,
        nodePath: replay.nodePath,
        cancelGraceMs: replay.cancelGraceMs,
      },
      {
        scriptPath: replay.scriptPathOf(slug),
        cwd: replay.cwd,
        isHeadless,
        launchEnv: {},
        stepOffsetsMs: recording.events.map((event) => event.offsetMs),
      },
    );
    return toLiveReplayView(live);
  }

  private async persistActiveRecording(): Promise<void> {
    const live = this.active;
    this.active = null;
    if (live === null) return;
    await live.stop().catch(() => undefined);
  }
}
