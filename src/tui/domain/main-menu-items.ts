import type { MenuTarget } from './intent.ts';

export interface MainMenuItem {
  readonly label: string;
  readonly target: MenuTarget | 'quit';
  /** Disabled while Chromium is unavailable. */
  readonly isBrowserRequired: boolean;
}

export const MAIN_MENU_ITEMS: readonly MainMenuItem[] = [
  { label: 'New recording', target: 'new-recording', isBrowserRequired: true },
  { label: 'Library', target: 'library', isBrowserRequired: false },
  { label: 'Quit', target: 'quit', isBrowserRequired: false },
];
