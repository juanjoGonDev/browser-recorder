import type { AppState, Screen } from './app-state.ts';

type ScreenOf<K extends Screen['kind']> = Extract<Screen, { kind: K }>;

/**
 * Applies `update` only while the app is on a `kind` screen. A late action
 * for a screen the user already left is dropped instead of corrupting state.
 */
export function updateScreen<K extends Screen['kind']>(
  state: AppState,
  kind: K,
  update: (screen: ScreenOf<K>) => Screen,
): AppState {
  if (state.screen.kind !== kind) return state;
  return { ...state, screen: update(state.screen as ScreenOf<K>) };
}
