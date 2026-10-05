import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLaunchSettings } from '../../../src/recording-capture/domain/launch-arguments.ts';
import type { LaunchTargetFacts } from '../../../src/recording-capture/domain/launch-arguments.ts';
import type { Display } from '../../../src/shared/domain/recording.ts';

interface ParityCase {
  readonly name: string;
  readonly display: Display;
  readonly target: LaunchTargetFacts;
  readonly expected: unknown;
}

const CASES_FILE = path.join(
  import.meta.dirname,
  '..',
  '..',
  'fixtures',
  'launch-parity',
  'cases.json',
);

const cases = JSON.parse(readFileSync(CASES_FILE, 'utf8')) as ParityCase[];

/**
 * The generated script's prelude is checked against the same file
 * (script-prelude.test.ts), so the recorder and a replay cannot launch the
 * same recording with different rules.
 */
describe('launch rules shared by the recorder and generated scripts', () => {
  it('covers the window, emulated and real keychain cases', () => {
    expect(cases.map((entry) => entry.name)).toHaveLength(3);
  });

  it.each(cases.map((entry) => [entry.name, entry] as const))(
    'the recorder builds the golden settings for %s',
    (_name, entry) => {
      const settings = buildLaunchSettings(entry.display, entry.target);
      // JSON has no `undefined`: the prelude parity test maps it to null too.
      const comparable = JSON.parse(
        JSON.stringify(settings, (_key, value: unknown) =>
          value === undefined ? null : value,
        ),
      ) as unknown;
      expect(comparable).toStrictEqual(entry.expected);
    },
  );
});
