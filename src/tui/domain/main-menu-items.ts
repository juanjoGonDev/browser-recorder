import type { MenuTarget } from './intent.ts';

export interface MainMenuItem {
  readonly label: string;
  readonly target: MenuTarget | 'quit';
}

export const MAIN_MENU_ITEMS: readonly MainMenuItem[] = [
  { label: 'New recording', target: 'new-recording' },
  { label: 'Library', target: 'library' },
  { label: 'Quit', target: 'quit' },
];
