import type { LibraryScreen } from '../domain/app-state.ts';
import type { LibraryEntryView } from '../domain/app-views.ts';
import { messageOf, type ControllerDeps } from './controller-deps.ts';

type ValidEntry = Extract<LibraryEntryView, { kind: 'valid' }>;

export interface LibraryFlow {
  /** Opens the library screen and loads it. */
  show(): Promise<void>;
  /** Reloads the list, only while the user is just browsing. */
  refresh(): Promise<void>;
  rename(): Promise<void>;
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

  async rename(): Promise<void> {
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
