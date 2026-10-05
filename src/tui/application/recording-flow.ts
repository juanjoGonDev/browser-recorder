import type {
  LiveRecordingView,
  RecordingUpdateView,
} from '../domain/app-views.ts';
import {
  messageOf,
  syncClock,
  type ControllerDeps,
} from './controller-deps.ts';
import { BUNDLED_EPHEMERAL } from '../../shared/domain/browser-choice.ts';
import type { NewRecordingRequest } from './ports/app-services.ts';

export interface RecordingFlow {
  /** Validates the form and starts recording. */
  submitForm(): Promise<void>;
  /** Saves and ends the session; a second call while stopping is ignored. */
  stop(): Promise<void>;
  /** `false` keeps recording; `true` deletes the session. */
  answerDiscard(isYes: boolean): Promise<void>;
  respondToDialog(action: 'accept' | 'dismiss'): Promise<void>;
  isActive(): boolean;
}

export function createRecordingFlow(
  deps: ControllerDeps,
  showLibrary: () => Promise<void>,
): RecordingFlow {
  return new LiveRecordingFlow(deps, showLibrary);
}

class LiveRecordingFlow implements RecordingFlow {
  private live: LiveRecordingView | null = null;
  private unsubscribe: () => void = () => undefined;
  private isStopping = false;

  private readonly deps: ControllerDeps;
  private readonly showLibrary: () => Promise<void>;

  constructor(deps: ControllerDeps, showLibrary: () => Promise<void>) {
    this.deps = deps;
    this.showLibrary = showLibrary;
  }

  isActive(): boolean {
    return this.live !== null;
  }

  async submitForm(): Promise<void> {
    const { screen } = this.deps.store.getState();
    if (screen.kind !== 'new-recording') return;
    const name = screen.name.value.trim();
    const url = screen.startUrl.value.trim();
    const { library } = this.deps.services;
    const invalid = library.validateName(name) ?? library.validateStartUrl(url);
    if (invalid !== null) {
      this.deps.store.dispatch({ type: 'form-error', message: invalid });
      return;
    }
    await this.begin({ name, startUrl: url === '' ? null : url });
  }

  async stop(): Promise<void> {
    const live = this.live;
    if (live === null || this.isStopping) return;
    this.isStopping = true;
    this.deps.store.dispatch({ type: 'recording-stopping' });
    let failure: string | null = null;
    try {
      await live.stop();
    } catch (error) {
      failure = messageOf(error);
    }
    await this.leave(failure);
  }

  async answerDiscard(isYes: boolean): Promise<void> {
    const live = this.live;
    if (!isYes || live === null) {
      this.deps.store.dispatch({ type: 'cancel-discard' });
      return;
    }
    let failure: string | null = null;
    try {
      await live.discard();
    } catch (error) {
      failure = messageOf(error);
    }
    await this.leave(failure);
  }

  async respondToDialog(action: 'accept' | 'dismiss'): Promise<void> {
    const { screen } = this.deps.store.getState();
    if (this.live === null || screen.kind !== 'recording') return;
    const isPromptAnswer =
      action === 'accept' && screen.pendingDialog?.dialogType === 'prompt';
    await this.live.respondToDialog({
      action,
      promptText: isPromptAnswer ? screen.promptText.value : null,
    });
  }

  private async begin(request: NewRecordingRequest): Promise<void> {
    syncClock(this.deps);
    try {
      this.live = await this.deps.services.recording.start({
        ...request,
        // Until the form offers a picker, every recording uses the default.
        browser: BUNDLED_EPHEMERAL,
      });
    } catch (error) {
      this.deps.store.dispatch({
        type: 'form-error',
        message: messageOf(error),
      });
      return;
    }
    this.deps.store.dispatch({ type: 'recording-started', name: request.name });
    this.unsubscribe = this.live.subscribe((update) => {
      this.onUpdate(update);
    });
  }

  private onUpdate(update: RecordingUpdateView): void {
    this.deps.store.dispatch({ type: 'recording-updated', update });
    if (update.isClosed) void this.leave(null);
  }

  /** Releases the session and returns to the library, showing any failure. */
  private async leave(failure: string | null): Promise<void> {
    if (this.live === null) return;
    this.unsubscribe();
    this.live = null;
    this.isStopping = false;
    await this.showLibrary();
    if (failure !== null) {
      this.deps.store.dispatch({ type: 'library-error', message: failure });
    }
  }
}
