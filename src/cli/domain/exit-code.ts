export type InterruptSignal = 'SIGINT' | 'SIGTERM' | 'SIGBREAK';

export type CliOutcome =
  | { readonly kind: 'success' }
  | { readonly kind: 'failure' }
  | { readonly kind: 'usage' }
  | { readonly kind: 'interrupted'; readonly signal: InterruptSignal };

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;
/** By shell convention a signal ends a process with 128 plus its number. */
const SIGNAL_EXIT_BASE = 128;
const SIGNAL_NUMBERS: Readonly<Record<InterruptSignal, number>> = {
  SIGINT: 2,
  SIGTERM: 15,
  SIGBREAK: 21,
};

export function exitCodeFor(outcome: CliOutcome): number {
  switch (outcome.kind) {
    case 'success':
      return EXIT_SUCCESS;
    case 'failure':
      return EXIT_FAILURE;
    case 'usage':
      return EXIT_USAGE;
    case 'interrupted':
      return SIGNAL_EXIT_BASE + SIGNAL_NUMBERS[outcome.signal];
  }
}
