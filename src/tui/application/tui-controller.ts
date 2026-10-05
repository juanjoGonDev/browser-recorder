import { BROWSER_REQUIRED_REASON } from '../domain/browser-required.ts';
import type { Intent } from '../domain/intent.ts';
import { keymap } from '../domain/keymap.ts';
import { MAIN_MENU_ITEMS } from '../domain/main-menu-items.ts';
import type { AppStore } from './app-store.ts';
import {
  messageOf,
  syncClock,
  type ControllerDeps,
} from './controller-deps.ts';
import { createLibraryFlow, type LibraryFlow } from './library-flow.ts';
import type { AppServices } from './ports/app-services.ts';
import type { KeyPress } from './ports/terminal.ts';
import type { Timers } from './ports/timers.ts';
import { createRecordingFlow, type RecordingFlow } from './recording-flow.ts';
import { createReplayFlow, type ReplayFlow } from './replay-flow.ts';

export interface TuiController {
  /** Checks (and if needed installs) Chromium, then opens the main menu. */
  start(): Promise<void>;
  handleKey(key: KeyPress): Promise<void>;
  /** Called on a timer: reloads the library list while it is on screen. */
  refreshLibrary(): Promise<void>;
}

export interface TuiControllerDeps {
  readonly services: AppServices;
  readonly store: AppStore;
  readonly timers: Timers;
}

const MANUAL_INSTALL_COMMAND = 'pnpm exec patchright install chromium';

type Handler<K extends Intent['kind']> = (
  intent: Extract<Intent, { kind: K }>,
) => Promise<void> | void;

type Handlers = { readonly [K in Intent['kind']]: Handler<K> };

export function createTuiController(deps: TuiControllerDeps): TuiController {
  return new IntentController(deps);
}

class IntentController implements TuiController {
  private isBusy = false;
  private readonly deps: ControllerDeps;
  private readonly library: LibraryFlow;
  private readonly recording: RecordingFlow;
  private readonly replay: ReplayFlow;
  private readonly handlers: Handlers;

  constructor(deps: ControllerDeps) {
    this.deps = deps;
    this.library = createLibraryFlow(deps);
    this.recording = createRecordingFlow(deps, () => this.library.show());
    this.replay = createReplayFlow(deps);
    this.handlers = this.buildHandlers();
  }

  async start(): Promise<void> {
    const { store, services } = this.deps;
    syncClock(this.deps);
    let isInstalling = false;
    try {
      const result = await services.environment.ensureBrowser((line) => {
        if (!isInstalling) store.dispatch({ type: 'setup-installing' });
        isInstalling = true;
        store.dispatch({ type: 'setup-output', line });
      });
      store.dispatch(
        result.kind === 'ready'
          ? {
              type: 'setup-ready',
              linuxHint: result.linuxHint,
              browsers: result.browsers,
            }
          : {
              type: 'setup-failed',
              manualCommand: result.manualCommand,
              exitCode: result.exitCode,
              browsers: await this.otherBrowsers(),
            },
      );
    } catch (error) {
      store.dispatch({ type: 'setup-output', line: messageOf(error) });
      store.dispatch({
        type: 'setup-failed',
        manualCommand: MANUAL_INSTALL_COMMAND,
        exitCode: null,
        browsers: await this.otherBrowsers(),
      });
    }
  }

  /** Labels of the detected browsers that do not need the bundled install. */
  private async otherBrowsers(): Promise<readonly string[]> {
    try {
      const views = await this.deps.services.browsers.list();
      return views
        .filter((view) => view.browserId !== 'bundled')
        .map((view) => view.label);
    } catch {
      return [];
    }
  }

  async handleKey(key: KeyPress): Promise<void> {
    const intent = keymap(this.deps.store.getState(), key);
    if (intent === null || (this.isBusy && intent.kind !== 'quit')) return;
    try {
      const pending = this.run(intent);
      // Synchronous intents (typing, moving) never block the next key, so a
      // paste that arrives as many key presses in one tick is not dropped.
      if (pending === undefined) return;
      this.isBusy = true;
      await pending;
    } catch (error) {
      this.report(messageOf(error));
    } finally {
      this.isBusy = false;
    }
  }

  refreshLibrary(): Promise<void> {
    return this.library.refresh();
  }

  private run(intent: Intent): Promise<void> | undefined {
    const handler = this.handlers[intent.kind] as (
      current: Intent,
    ) => Promise<void> | void;
    const result = handler(intent);
    return result instanceof Promise ? result : undefined;
  }

  /** Last resort: show an unexpected failure where the user is looking. */
  private report(message: string): void {
    const { store } = this.deps;
    const { screen } = store.getState();
    if (screen.kind === 'new-recording') {
      store.dispatch({ type: 'form-error', message });
    } else if (screen.kind === 'library') {
      store.dispatch({ type: 'library-error', message });
    }
  }

  private async shutdown(): Promise<void> {
    try {
      await this.recording.stop();
      await this.replay.cancel();
    } finally {
      this.deps.store.dispatch({ type: 'quit' });
    }
  }

  private open(
    target: 'main-menu' | 'library' | 'new-recording',
  ): Promise<void> | undefined {
    if (target === 'library') return this.library.show();
    if (target === 'new-recording' && !this.isBrowserAvailable()) {
      this.explainBrowserRequired();
      return undefined;
    }
    this.deps.store.dispatch({ type: 'navigate', target });
    // Detection never blocks typing: Enter is refused until the list arrives.
    if (target === 'new-recording') void this.recording.loadBrowsers();
    return undefined;
  }

  private activate(): Promise<void> | undefined {
    const { screen } = this.deps.store.getState();
    const item =
      screen.kind === 'main-menu'
        ? MAIN_MENU_ITEMS[screen.selected]
        : undefined;
    if (item === undefined) return undefined;
    return item.target === 'quit' ? this.shutdown() : this.open(item.target);
  }

  private async submit(): Promise<void> {
    const { kind } = this.deps.store.getState().screen;
    if (kind === 'new-recording') await this.recording.submitForm();
    else if (kind === 'library') await this.library.rename();
  }

  private cancel(): Promise<void> | undefined {
    const { store } = this.deps;
    const { kind } = store.getState().screen;
    if (kind === 'new-recording') {
      store.dispatch({ type: 'navigate', target: 'main-menu' });
    } else if (kind === 'library') {
      store.dispatch({ type: 'cancel-mode' });
    } else {
      return this.library.show();
    }
    return undefined;
  }

  private async answerConfirm(isYes: boolean): Promise<void> {
    const { kind } = this.deps.store.getState().screen;
    if (kind === 'recording') await this.recording.answerDiscard(isYes);
    else await this.library.answerDelete(isYes);
  }

  private isBrowserAvailable(): boolean {
    return this.deps.store.getState().isBrowserAvailable;
  }

  /** The menu always shows the reason; the library needs an inline error. */
  private explainBrowserRequired(): void {
    const { store } = this.deps;
    if (store.getState().screen.kind === 'library') {
      store.dispatch({
        type: 'library-error',
        message: BROWSER_REQUIRED_REASON,
      });
    }
  }

  private async replaySelected(): Promise<void> {
    if (!this.isBrowserAvailable()) {
      this.explainBrowserRequired();
      return;
    }
    const entry = this.library.selectedEntry();
    if (entry !== null) await this.replay.start(entry.slug);
  }

  private buildHandlers(): Handlers {
    return { ...this.screenHandlers(), ...this.flowHandlers() };
  }

  private screenHandlers(): Pick<
    Handlers,
    | 'quit'
    | 'retry-setup'
    | 'open'
    | 'move-selection'
    | 'page-selection'
    | 'activate'
    | 'switch-field'
    | 'edit-text'
    | 'submit'
    | 'cancel'
  > {
    const { store } = this.deps;
    return {
      quit: () => this.shutdown(),
      'retry-setup': () => {
        store.dispatch({ type: 'setup-installing' });
        return this.start();
      },
      open: (intent) => this.open(intent.target),
      'move-selection': (intent) => {
        store.dispatch({ type: 'move-selection', delta: intent.delta });
      },
      'page-selection': (intent) => {
        store.dispatch({ type: 'page-selection', direction: intent.direction });
      },
      activate: () => this.activate(),
      'switch-field': () => {
        store.dispatch({ type: 'switch-field' });
      },
      'edit-text': (intent) => {
        store.dispatch({ type: 'edit-text', edit: intent.edit });
      },
      submit: () => this.submit(),
      cancel: () => this.cancel(),
    };
  }

  private flowHandlers(): Omit<
    Handlers,
    keyof ReturnType<IntentController['screenHandlers']>
  > {
    const { store } = this.deps;
    return {
      'stop-recording': () => this.recording.stop(),
      'cycle-option': (intent) => {
        store.dispatch({ type: 'cycle-option', delta: intent.delta });
      },
      'request-discard': () => {
        store.dispatch({ type: 'request-discard' });
      },
      'answer-confirm': (intent) => this.answerConfirm(intent.isYes),
      'respond-dialog': (intent) =>
        this.recording.respondToDialog(intent.action),
      'replay-selected': () => this.replaySelected(),
      'show-timeline': () => this.library.showTimeline(),
      'begin-rename': () => {
        store.dispatch({ type: 'begin-rename' });
      },
      'begin-delete': () => {
        store.dispatch({ type: 'begin-delete' });
      },
      'cancel-replay': () => this.replay.cancel(),
    };
  }
}
