import type { ChangeBrowserMode } from '../../domain/app-state.ts';
import type { RenderContext } from '../screen-view.ts';
import type { KeyHint } from '../status-bar.ts';
import { renderPickers } from './browser-pickers.ts';

export const CHANGE_BROWSER_HINTS: readonly KeyHint[] = [
  { key: 'tab', label: 'next field' },
  { key: '←→', label: 'change' },
  { key: 'enter', label: 'save' },
  { key: 'esc', label: 'cancel' },
];

/** The question shown in the status line while the picker is open. */
export function changeBrowserPrompt(
  name: string,
  context: RenderContext,
): string {
  return context.style.bold(`Browser for "${name}"`);
}

export function changeBrowserLines(
  mode: ChangeBrowserMode,
  context: RenderContext,
): string[] {
  return renderPickers(mode, mode.focus, context);
}
