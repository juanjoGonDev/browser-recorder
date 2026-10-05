import type { InterruptSignals } from '../application/ports/interrupt-signals.ts';
import type { InterruptSignal } from '../domain/exit-code.ts';

export interface SignalSource {
  on(event: InterruptSignal, listener: () => void): unknown;
  off(event: InterruptSignal, listener: () => void): unknown;
}

export interface ProcessInterruptDeps {
  /** `process` in production. */
  readonly source: SignalSource;
  /** `process.platform`: only Windows has SIGBREAK. */
  readonly platform: string;
}

const COMMON_SIGNALS: readonly InterruptSignal[] = ['SIGINT', 'SIGTERM'];

function signalsFor(platform: string): readonly InterruptSignal[] {
  return platform === 'win32'
    ? [...COMMON_SIGNALS, 'SIGBREAK']
    : COMMON_SIGNALS;
}

/** Ctrl+C, termination and Ctrl+Break, as a port. */
export function createProcessInterruptSignals(
  deps: ProcessInterruptDeps,
): InterruptSignals {
  const names = signalsFor(deps.platform);
  return {
    listen: (handler) => {
      const registered = names.map((name) => {
        const listener = (): void => {
          handler(name);
        };
        deps.source.on(name, listener);
        return { name, listener };
      });
      return () => {
        for (const { name, listener } of registered) {
          deps.source.off(name, listener);
        }
      };
    },
  };
}
