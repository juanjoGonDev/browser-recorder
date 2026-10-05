import type { BrowserId } from '../../shared/domain/browser-choice.ts';

/** Where the tool keeps its own profiles, per browser. */
export interface ProfileLayout {
  /** `<root>/profiles/<id>/managed` */
  managedDir(id: BrowserId): string;
  /** `<root>/profiles/<id>/sessions`: copies and ephemeral profiles. */
  sessionsRoot(id: BrowserId): string;
}
