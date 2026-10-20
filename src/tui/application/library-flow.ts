import type { ChangeBrowserMode, LibraryScreen } from '../domain/app-state.ts';
import type { LibraryEntryView } from '../domain/app-views.ts';
import { isSameChoice } from '../domain/browser-picker.ts';
import { chosenBrowser, loadBrowserOptions } from './browser-options.ts';
import { messageOf, type ControllerDeps } from './controller-deps.ts';

type ValidEntry = Extract<LibraryEntryView, { kind: 'valid' }>;

export interface LibraryFlow {
  /** Opens the library screen and loads it. */
  show(): Promise<void>;
  /** Reloads the list, only while the user is just browsing. */
  refresh(): Promise<void>;
  /** Saves what the open mode edits: a new name or another browser. */
  submit(): Promise<void>;
  /** Opens the browser picker on the selected recording; detection runs on. */
  beginBrowserChange(): void;
  answerDelete(isYes: boolean): Promise<void>;
  showTimeline(): Promise<void>;
  /** The highlighted entry when it is a readable recording. */
  selectedEntry(): ValidEntry | null;
}

export function createLibraryFlow(deps: ControllerDeps): LibraryFlow {
  return new StoreLibraryFlow(deps);
}

class StoreLibraryFlow implements LibraryFlow {
  private readonly deps: ControllerDeps;

  constructor(deps: ControllerDeps) {
    this.deps = deps;
  }

  async show(): Promise<void> {
    this.deps.store.dispatch({ type: 'navigate', target: 'library' });
    await this.load();
  }

  async refresh(): Promise<void> {
    if (this.screen()?.mode.kind === 'browse') await this.load();
  }

  async submit(): Promise<void> {
    const mode = this.screen()?.mode;
    if (mode?.kind === 'rename') await this.rename();
    else if (mode?.kind === 'change-browser') await this.saveBrowser(mode);
  }

  beginBrowserChange(): void {
    this.deps.store.dispatch({ type: 'begin-browser-change' });
    if (this.screen()?.mode.kind === 'change-browser') void this.detect();
  }

  private async rename(): Promise<void> {
    const mode = this.screen()?.mode;
    const entry = this.selectedEntry();
    if (mode?.kind !== 'rename' || entry === null) return;
    const name = mode.field.value.trim();
    const invalid = this.deps.services.library.validateName(name);
    if (invalid !== null) {
      this.fail(invalid);
      return;
    }
    try {
      await this.deps.services.library.rename(entry.slug, name);
      this.deps.store.dispatch({ type: 'cancel-mode' });
      await this.load();
    } catch (error) {
      this.fail(messageOf(error));
    }
  }

  /** An unchanged choice just closes; nothing is written then. */
  private async saveBrowser(mode: ChangeBrowserMode): Promise<void> {
    const choice = chosenBrowser(mode);
    if (typeof choice === 'string') {
      this.fail(choice);
      return;
    }
    if (isSameChoice(choice, mode.current)) {
      this.deps.store.dispatch({ type: 'cancel-mode' });
      return;
    }
    try {
      await this.deps.services.library.changeBrowser(mode.slug, choice);
      this.deps.store.dispatch({ type: 'cancel-mode' });
      await this.load();
    } catch (error) {
      this.fail(messageOf(error));
    }
  }

  private async detect(): Promise<void> {
    const { store } = this.deps;
    try {
      const browsers = await loadBrowserOptions(this.deps);
      store.dispatch({ type: 'browsers-loaded', browsers });
    } catch (error) {
      store.dispatch({ type: 'browsers-failed', message: messageOf(error) });
    }
  }

  async answerDelete(isYes: boolean): Promise<void> {
    const entry = this.currentEntry();
    this.deps.store.dispatch({ type: 'cancel-mode' });
    if (!isYes || entry === null) return;
    try {
      await this.deps.services.library.remove(entry.slug);
      await this.load();
    } catch (error) {
      this.fail(messageOf(error));
    }
  }

  async showTimeline(): Promise<void> {
    const entry = this.selectedEntry();
    if (entry === null) return;
    try {
      const recording = await this.deps.services.library.load(entry.slug);
      this.deps.store.dispatch({ type: 'timeline-opened', recording });
    } catch (error) {
      this.fail(messageOf(error));
    }
  }

  selectedEntry(): ValidEntry | null {
    const entry = this.currentEntry();
    return entry?.kind === 'valid' ? entry : null;
  }

  private currentEntry(): LibraryEntryView | null {
    const screen = this.screen();
    return screen?.entries[screen.cursor.selected] ?? null;
  }

  private screen(): LibraryScreen | null {
    const { screen } = this.deps.store.getState();
    return screen.kind === 'library' ? screen : null;
  }

  private fail(message: string): void {
    this.deps.store.dispatch({ type: 'library-error', message });
  }

  private async load(): Promise<void> {
    try {
      const entries = await this.deps.services.library.list();
      this.deps.store.dispatch({ type: 'library-loaded', entries });
    } catch (error) {
      this.fail(messageOf(error));
    }
  }
}
