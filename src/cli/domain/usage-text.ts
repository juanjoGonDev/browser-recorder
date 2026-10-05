import {
  DEFAULT_HUMAN_DELAY,
  MAX_DELAY_MS,
} from '../../shared/domain/replay-timing.ts';

const DEFAULT_RANGE = `${String(DEFAULT_HUMAN_DELAY.minMs)}-${String(DEFAULT_HUMAN_DELAY.maxMs)}`;

/** The help text; it is also printed after a usage error. */
export function usageText(): string {
  return [
    'Usage:',
    '  browser-recorder                      open the interactive recorder',
    '  browser-recorder replay <name|slug>   replay one saved recording',
    '',
    'Options for replay:',
    '  -r, --random              human-like pauses between steps',
    `  -d, --delay <min-max>     pause range in ms (default ${DEFAULT_RANGE}, max ${String(MAX_DELAY_MS)}); implies --random`,
    '      --headless            run without a visible browser window',
    '',
    'General options:',
    '  -h, --help                show this help',
    '  -v, --version             show the version',
    '',
    'Exit codes:',
    '  0    the replay succeeded',
    '  1    the replay failed or could not start',
    '  2    usage error, recording not found or ambiguous',
    '  130  interrupted (Ctrl+C); 143 on SIGTERM',
    '',
  ].join('\n');
}
