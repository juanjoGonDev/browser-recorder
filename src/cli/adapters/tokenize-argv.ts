import { parseArgs } from 'node:util';

import { parseDelayRange } from '../domain/parse-delay-range.ts';
import type { ParsedArguments } from '../domain/interpret-arguments.ts';

const OPTIONS = {
  random: { type: 'boolean', short: 'r' },
  delay: { type: 'string', short: 'd' },
  headless: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const;

/**
 * Node's messages carry a second sentence about `node main.js --`, which
 * means nothing to someone running `browser-recorder`: keep the first one.
 */
function readableReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const [first = message] = message.split('. ');
  return `${first.replaceAll("'", '"').replace(/\.$/u, '')}.`;
}

const DELAY_FLAGS = new Set(['-d', '--delay']);

/**
 * `-d -5-10` makes Node ask for `--delay=-5-10`; the user wrote a delay, so
 * the answer is the range rule, with the one way to write that value.
 */
function ambiguousDelay(
  error: unknown,
  argv: readonly string[],
): string | null {
  const message = error instanceof Error ? error.message : '';
  if (!message.includes('is ambiguous')) return null;
  const at = argv.findIndex((token) => DELAY_FLAGS.has(token));
  const value = argv[at + 1];
  if (at < 0 || value === undefined) return null;
  const rule = parseDelayRange(value);
  const reason =
    rule.kind === 'invalid' ? rule.message.replace(/\.$/u, '') : '';
  return `${reason}; write it as --delay=${value} if you meant that value.`;
}

/** Wraps `node:util` `parseArgs`; a refusal becomes a value, never a throw. */
export function tokenizeArgv(argv: readonly string[]): ParsedArguments {
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      options: OPTIONS,
      strict: true,
      allowPositionals: true,
    });
    return {
      kind: 'parsed',
      positionals,
      flags: {
        isRandom: values.random === true,
        delay: values.delay ?? null,
        isHeadless: values.headless === true,
        isHelp: values.help === true,
        isVersion: values.version === true,
      },
    };
  } catch (error) {
    return {
      kind: 'rejected',
      message: ambiguousDelay(error, argv) ?? readableReason(error),
    };
  }
}
