import { appReducer, initialState } from '../domain/app-reducer.ts';
import type { AppAction } from '../domain/app-action.ts';
import type { AppState } from '../domain/app-state.ts';

export interface AppStore {
  getState(): AppState;
  dispatch(action: AppAction): void;
  /** Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** The single mutable cell of the app; every change goes through the reducer. */
export function createAppStore(initial: AppState = initialState()): AppStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = appReducer(state, action);
      if (next === state) return;
      state = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
