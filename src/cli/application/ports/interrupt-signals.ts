import type { InterruptSignal } from '../../domain/exit-code.ts';

export interface InterruptSignals {
  /** Calls `handler` for Ctrl+C and termination; returns how to stop. */
  listen(handler: (signal: InterruptSignal) => void): () => void;
}
