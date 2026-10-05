import type { AppStore } from './app-store.ts';
import type { AppServices } from './ports/app-services.ts';
import type { Timers } from './ports/timers.ts';

/** What every flow of the controller needs; all of it injected. */
export interface ControllerDeps {
  readonly services: AppServices;
  readonly store: AppStore;
  readonly timers: Timers;
}

/** The message of a failure, safe to show inline. */
export function messageOf(error: unknown): string {
  return error instanceof Error && error.message !== ''
    ? error.message
    : 'Something went wrong.';
}

/** Syncs the store clock so a screen started now measures from now. */
export function syncClock(deps: ControllerDeps): void {
  deps.store.dispatch({ type: 'tick', nowMs: deps.timers.now() });
}
