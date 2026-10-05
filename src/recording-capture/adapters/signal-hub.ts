import type { SessionSignal } from '../application/ports/browser-launcher.ts';

export interface SignalHub {
  emit(signal: SessionSignal): void;
  onSignal(listener: (signal: SessionSignal) => void): void;
}

/**
 * Delivers signals to one listener. The browser starts navigating before its
 * consumer has subscribed, so signals are held until the listener arrives and
 * then delivered in order.
 */
export function createSignalHub(): SignalHub {
  let listener: ((signal: SessionSignal) => void) | null = null;
  const held: SessionSignal[] = [];
  return {
    emit(signal) {
      if (listener === null) held.push(signal);
      else listener(signal);
    },
    onSignal(next) {
      listener = next;
      for (const signal of held.splice(0)) next(signal);
    },
  };
}
