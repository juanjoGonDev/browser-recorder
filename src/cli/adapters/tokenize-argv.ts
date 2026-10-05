import { parseArgs } from 'node:util';

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
    return { kind: 'rejected', message: readableReason(error) };
  }
}
