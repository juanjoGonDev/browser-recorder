import { timingPrelude } from '../../src/script-generation/domain/timing-prelude.ts';

export type Sleep = (ms: number) => Promise<void>;

export interface Timing {
  readonly isHuman: boolean;
  readonly delay: { readonly minMs: number; readonly maxMs: number };
  readonly beforeStep: (options: {
    readonly isFollowUp: boolean;
  }) => Promise<void>;
  readonly keyPause: () => Promise<void>;
}

interface TimingModule {
  readonly createTiming: (
    env: Readonly<Record<string, string | undefined>>,
    sleep: Sleep,
  ) => Timing;
  readonly readDelayRange: (text: string | undefined) => {
    readonly minMs: number;
    readonly maxMs: number;
  };
  readonly readSeed: (text: string | undefined) => number;
}

/** Evaluates the timing runtime the way a generated script carries it. */
export function loadTimingPrelude(): TimingModule {
  // The prelude is source text for a script: evaluating it is the point.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(
    `${timingPrelude}\nreturn { createTiming, readDelayRange, readSeed };`,
  ) as () => TimingModule;
  return factory();
}

/** A sleep that records every requested delay instead of waiting. */
export function recordingSleep(): { sleep: Sleep; waits: number[] } {
  const waits: number[] = [];
  return {
    waits,
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}
