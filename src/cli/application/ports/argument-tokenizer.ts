import type { ParsedArguments } from '../../domain/interpret-arguments.ts';

/** Splits argv into positionals and flags; never throws, refuses instead. */
export interface ArgumentTokenizer {
  tokenize(argv: readonly string[]): ParsedArguments;
}
