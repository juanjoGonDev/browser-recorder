import type { BrowserInstallation } from '../environment-setup/application/ports/browser-installation.ts';
import { ensureBrowser } from '../environment-setup/application/ensure-browser.ts';
import { linuxDepsHint } from '../environment-setup/domain/linux-deps-hint.ts';
import type { BrowserLauncher } from '../recording-capture/application/ports/browser-launcher.ts';
import type { MonotonicClock } from '../recording-capture/application/ports/monotonic-clock.ts';
import { startRecording } from '../recording-capture/application/recording-session.ts';
import type {
  LiveRecording,
  StartRecordingRequest,
} from '../recording-capture/application/recording-session.ts';
import type { Recording } from '../shared/domain/recording.ts';
import type { LibraryService } from '../script-library/application/library-service.ts';
import { validateName } from '../script-library/domain/validate-name.ts';
import { validateStartUrl } from '../script-library/domain/validate-start-url.ts';
import type { BrowserChoice } from '../shared/domain/browser-choice.ts';
import type { ReplayTiming } from '../shared/domain/replay-timing.ts';
import type { AppServices } from '../tui/application/ports/app-services.ts';
import type {
  EnvironmentView,
  LibraryEntryView,
} from '../tui/domain/app-views.ts';
import type { LaunchPlan, LaunchPlanner } from './browser-launch-plan.ts';
import type { BrowserViews } from './browser-views.ts';
import { toLiveRecordingView } from './recording-views.ts';
import { launchReplay, type ReplayDeps } from './launch-replay.ts';
import { toLiveReplayView } from './replay-views.ts';

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
  readonly planner: LaunchPlanner;
  readonly browserViews: BrowserViews;
  /** Deletes the profile copies a crashed run left behind. */
  readonly sweepStaleSessions: () => Promise<void>;
}

/** `AppServices` plus what the entry point needs when the process is cut short. */
export interface ComposedServices extends AppServices {
  /** Saves and closes the live recording, if any; never rejects. */
  persistActiveRecording(): Promise<void>;
}

const INSTALLING_MESSAGE =
  'Chromium is not installed yet; installing it now (one time, about 150 MB)...';

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toEntryView(
  listing: Awaited<ReturnType<LibraryService['list']>>[number],
): LibraryEntryView {
  if (listing.kind === 'invalid') return listing;
  const { slug, name, createdAt, durationMs, stepCount, browser } =
    listing.summary;
  return {
    kind: 'valid',
    slug,
    name,
    createdAt,
    durationMs,
    stepCount,
    browser,
  };
}

function sessionRequest(
  draft: Recording,
  plan: LaunchPlan,
): StartRecordingRequest {
  return {
    name: draft.name,
    slug: draft.slug,
    startUrl: draft.startUrl,
    browser: plan.choice,
    target: plan.target,
  };
}

/** Releasing is cleanup: it must never turn a good run into a failure. */
function releaseQuietly(plan: LaunchPlan): Promise<void> {
  return plan.release().catch(() => undefined);
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
    void deps.sweepStaleSessions().catch(() => undefined);
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
      browsers: { list: () => this.deps.browserViews.options() },
      recording: {
        start: (request) => this.startRecording(request),
      },
      replay: { start: (slug, timing) => this.startReplay(slug, timing) },
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
    }).then(async (result) =>
      result.kind === 'ready'
        ? { ...result, browsers: await this.deps.browserViews.labels() }
        : result,
    );
  }

  private async startRecording(request: {
    readonly name: string;
    readonly startUrl: string | null;
    readonly browser: BrowserChoice;
  }) {
    const { library } = this.deps;
    const draft = await library.createDraft(request.name, request.startUrl);
    let plan: LaunchPlan | null = null;
    let live: LiveRecording;
    try {
      plan = await this.deps.planner.forRecording(request.browser);
      live = await this.launch(draft, plan);
    } catch (error) {
      if (plan !== null) await releaseQuietly(plan);
      await library.remove(draft.slug).catch(() => undefined);
      throw new Error(this.explainLaunchFailure(describe(error)));
    }
    return this.present(live, draft, plan);
  }

  private launch(draft: Recording, plan: LaunchPlan): Promise<LiveRecording> {
    const { library, launcher, clock, now, isHeadless } = this.deps;
    return startRecording(
      {
        launcher,
        clock,
        now,
        isHeadless,
        sink: { save: (recording) => library.save(recording) },
      },
      sessionRequest(draft, plan),
    );
  }

  private present(live: LiveRecording, draft: Recording, plan: LaunchPlan) {
    const { library } = this.deps;
    this.active = live;
    live.subscribe((update) => {
      if (!update.isClosed) return;
      if (this.active === live) this.active = null;
      void releaseQuietly(plan);
    });
    return toLiveRecordingView(
      live,
      {
        stop: async () => {
          try {
            await live.stop();
          } finally {
            await releaseQuietly(plan);
          }
        },
        discard: async () => {
          try {
            await live.discard();
            await library.remove(draft.slug);
          } finally {
            await releaseQuietly(plan);
          }
        },
      },
      plan.warnings,
    );
  }

  private explainLaunchFailure(message: string): string {
    const hint = linuxDepsHint(this.deps.platform, message);
    return hint === null ? message : `${message}\n${hint}`;
  }

  private async startReplay(slug: string, timing: ReplayTiming) {
    const { library, replay, isHeadless, planner, installation } = this.deps;
    const { live, warnings } = await launchReplay(
      { library, planner, installation, replay },
      slug,
      { timing, isHeadless },
    );
    return toLiveReplayView(live, warnings);
  }

  private async persistActiveRecording(): Promise<void> {
    const live = this.active;
    this.active = null;
    if (live === null) return;
    await live.stop().catch(() => undefined);
  }
}
