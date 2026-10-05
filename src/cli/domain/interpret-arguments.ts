import {
  RECORDED_TIMING,
  humanTiming,
  type ReplayTiming,
} from '../../shared/domain/replay-timing.ts';
import { parseDelayRange } from './parse-delay-range.ts';

export interface RawFlags {
  readonly isRandom: boolean;
  /** The text after `-d`/`--delay`, `null` when the flag was not given. */
  readonly delay: string | null;
  readonly isHeadless: boolean;
  readonly isHelp: boolean;
  readonly isVersion: boolean;
}

/** What the tokenizer made of argv: tokens, or the reason it refused them. */
export type ParsedArguments =
  | {
      readonly kind: 'parsed';
      readonly positionals: readonly string[];
      readonly flags: RawFlags;
    }
  | { readonly kind: 'rejected'; readonly message: string };

export type CliCommand =
  | { readonly kind: 'help' }
  | { readonly kind: 'version' }
  | { readonly kind: 'usage-error'; readonly message: string }
  | {
      readonly kind: 'replay';
      readonly query: string;
      readonly timing: ReplayTiming;
      readonly isHeadless: boolean;
    };

const REPLAY_COMMAND = 'replay';

function usageError(message: string): CliCommand {
  return { kind: 'usage-error', message };
}

/** `-d` alone implies human timing; neither flag keeps the recorded one. */
function timingOf(flags: RawFlags): ReplayTiming | CliCommand {
  if (flags.delay !== null) {
    const parsed = parseDelayRange(flags.delay);
    return parsed.kind === 'ok'
      ? humanTiming(parsed.range)
      : usageError(parsed.message);
  }
  return flags.isRandom ? humanTiming() : RECORDED_TIMING;
}

function isTiming(value: ReplayTiming | CliCommand): value is ReplayTiming {
  return value.kind === 'recorded' || value.kind === 'human';
}

function interpretReplay(
  positionals: readonly string[],
  flags: RawFlags,
): CliCommand {
  const [, query, extra] = positionals;
  if (query === undefined) {
    return usageError('Missing argument: replay needs a <name|slug>.');
  }
  if (extra !== undefined) return usageError(`Unexpected argument "${extra}".`);
  const timing = timingOf(flags);
  if (!isTiming(timing)) return timing;
  return { kind: 'replay', query, timing, isHeadless: flags.isHeadless };
}

/** Turns tokens into one command; every mistake is a usage error. */
export function interpretArguments(parsed: ParsedArguments): CliCommand {
  if (parsed.kind === 'rejected') return usageError(parsed.message);
  const { positionals, flags } = parsed;
  if (flags.isHelp) return { kind: 'help' };
  if (flags.isVersion) return { kind: 'version' };
  const [command] = positionals;
  if (command === undefined) {
    return usageError('Missing command: use "replay <name|slug>".');
  }
  if (command !== REPLAY_COMMAND) {
    return usageError(`Unknown command "${command}".`);
  }
  return interpretReplay(positionals, flags);
}
