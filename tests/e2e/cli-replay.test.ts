import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Target } from '../../src/shared/domain/locator.ts';
import type { RecordingEvent } from '../../src/shared/domain/recording-event.ts';
import {
  BUILD_TIMEOUT_MS,
  createTempPackageRoot,
  type TempPackageRoot,
} from '../support/cli-package-root.ts';
import { startFixtureServer } from '../support/fixture-server.ts';
import type { FixtureServer } from '../support/fixture-server.ts';
import { recordingOf } from '../support/golden-recordings.ts';

const REAL_RECORDINGS = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'recordings',
);
/** Scratch folders other test files create under the real recordings folder. */
const TRANSIENT_FOLDER = /^(?:e2e|build-out|scroll-runtime)-/u;
const TYPED = 'a"b\n€';
const MIN_PAUSE_MS = 300;
/** Clock granularity between the script's timers and the page's `Date.now`. */
const SLACK_MS = 15;
const SECRET = 'p@ss-€-secret';

const NOTES: Target = {
  locator: { kind: 'label', text: 'Notes' },
  nth: null,
  framePath: [],
  description: 'Notes',
};
const SEND: Target = {
  locator: { kind: 'role', role: 'button', name: 'Send' },
  nth: null,
  framePath: [],
  description: 'Send button',
};

function typingEvents(
  url: string,
  value: string,
  isSensitive = false,
): RecordingEvent[] {
  const base = { pageId: 'page1' } as const;
  return [
    {
      ...base,
      kind: 'page-opened',
      offsetMs: 0,
      openerPageId: null,
      cause: 'user',
      url: 'about:blank',
    },
    { ...base, kind: 'goto', offsetMs: 0, url },
    { ...base, kind: 'fill', offsetMs: 100, target: NOTES, value, isSensitive },
    {
      ...base,
      kind: 'click',
      offsetMs: 200,
      target: SEND,
      button: 'left',
      modifiers: [],
    },
  ];
}

function realRecordings(): string[] {
  try {
    return readdirSync(REAL_RECORDINGS).sort();
  } catch {
    return [];
  }
}

interface PageReport {
  readonly kind: string;
  readonly at: number;
  readonly value: string;
}

function parseReports(reports: readonly string[]): PageReport[] {
  return reports.map((report) => {
    const [kind = '', at = '0', ...rest] = report.split('|');
    return { kind, at: Number(at), value: rest.join('|') };
  });
}

/** From the last of `before` to the first of `after`, in milliseconds. */
function pauseBetween(
  before: readonly PageReport[],
  after: readonly PageReport[],
): number {
  const from = before.at(-1)?.at ?? Number.NaN;
  const to = after.at(0)?.at ?? Number.NaN;
  return to - from;
}

describe('node dist/main.js replay (temporary package root, headless)', () => {
  let server: FixtureServer;
  let pkg: TempPackageRoot;
  let recordingsBefore: string[] = [];

  beforeAll(async () => {
    recordingsBefore = realRecordings();
    server = await startFixtureServer();
    pkg = await createTempPackageRoot();
    const url = server.urlFor('typing.html');
    pkg.writeRecording(
      recordingOf(typingEvents(url, TYPED), {
        slug: 'typing',
        name: 'Typing flow',
      }),
    );
    pkg.writeRecording(
      recordingOf(typingEvents(url, SECRET, true), {
        slug: 'secret',
        name: 'Secret flow',
      }),
    );
    pkg.writeRecording(
      recordingOf(typingEvents('http://127.0.0.1:1/', TYPED), {
        slug: 'unreachable',
        name: 'Unreachable',
      }),
    );
  }, BUILD_TIMEOUT_MS);

  afterAll(async () => {
    pkg.dispose();
    await server.close();
  });

  it('replays in recorded mode, prints each step and exits 0 with an empty stderr', async () => {
    server.clearReports();
    const run = await pkg.run(['replay', 'typing']);
    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');
    const lines = run.stdout.trimEnd().split('\n');
    expect(
      lines.slice(0, 4).map((line) => line.replace(/ \(.*\)$/u, '')),
    ).toStrictEqual([
      `[1/4] page-opened about:blank`,
      `[2/4] goto ${server.urlFor('typing.html')}`,
      '[3/4] fill Notes',
      '[4/4] click Send button',
    ]);
    expect(lines.at(-1)).toMatch(/^✔ Typing flow replayed in \d+\.\ds$/u);
    expect(run.stdout).not.toMatch(/\u001b\[/u);
    const final = parseReports(server.reports()).filter(
      (report) => report.kind === 'click',
    );
    expect(final.map((report) => report.value)).toStrictEqual([TYPED]);
  });

  it('types in human mode with pauses of at least the minimum and the exact value', async () => {
    server.clearReports();
    const run = await pkg.run(
      [
        'replay',
        'Typing Flow',
        '-d',
        `${String(MIN_PAUSE_MS)}-${String(MIN_PAUSE_MS)}`,
      ],
      { BROWSER_RECORDER_SEED: '7' },
    );
    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');
    const reports = parseReports(server.reports());
    const timeline = {
      load: reports.filter((report) => report.kind === 'load'),
      inputs: reports.filter((report) => report.kind === 'input'),
      clicks: reports.filter((report) => report.kind === 'click'),
    };
    expect(timeline.clicks.map((report) => report.value)).toStrictEqual([
      TYPED,
    ]);
    // One input event per typed key: the field was filled key by key.
    expect(timeline.inputs.length).toBeGreaterThanOrEqual(
      Array.from(TYPED).length,
    );
    expect(timeline.inputs.at(-1)?.value).toBe(TYPED);
    expect(pauseBetween(timeline.load, timeline.inputs)).toBeGreaterThanOrEqual(
      MIN_PAUSE_MS - SLACK_MS,
    );
    expect(
      pauseBetween(timeline.inputs.slice(-1), timeline.clicks),
    ).toBeGreaterThanOrEqual(MIN_PAUSE_MS - SLACK_MS);
  });

  it('leaves the recording file byte for byte as it was, in both timing modes', async () => {
    const file = path.join(pkg.root, 'recordings', 'typing', 'recording.json');
    const before = readFileSync(file);
    expect((await pkg.run(['replay', 'typing'])).code).toBe(0);
    expect((await pkg.run(['replay', 'typing', '-d', '10-20'])).code).toBe(0);
    expect(readFileSync(file).equals(before)).toBe(true);
  });

  it('prints a sensitive value nowhere', async () => {
    const run = await pkg.run(['replay', 'secret', '-r', '-d', '10-20']);
    expect(run.code).toBe(0);
    expect(run.stdout + run.stderr).not.toContain('secret-');
    expect(run.stdout + run.stderr).not.toContain('p@ss');
  });

  it('reports a failing step on stderr and exits 1', async () => {
    const run = await pkg.run(['replay', 'unreachable']);
    expect(run.code).toBe(1);
    expect(run.stdout).toContain('[2/4] goto http://127.0.0.1:1/');
    expect(run.stderr).toMatch(/^✖ Unreachable failed at step 2 \(goto\): /u);
    expect(run.stdout).not.toContain('✔');
  });

  it.each([
    [['replay', 'does-not-exist'], /No recording matches "does-not-exist"/u],
    [['replay'], /Missing argument/u],
    [['replay', 'typing', '--nope'], /--nope/u],
    [['replay', 'typing', '-d', '900-250'], /minimum 900/u],
    [['foo'], /Unknown command "foo"/u],
  ])('exits 2 for %j without starting a browser', async (args, message) => {
    const run = await pkg.run(args);
    expect(run.code).toBe(2);
    expect(run.stderr).toMatch(message);
    expect(run.stdout).toBe('');
  });

  it('prints the usage and the package version with exit 0', async () => {
    const help = await pkg.run(['--help']);
    const version = await pkg.run(['-v']);
    const manifest = JSON.parse(
      readFileSync(path.join(pkg.root, 'package.json'), 'utf8'),
    ) as { version: string };
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('replay <name|slug>');
    expect(version).toMatchObject({ code: 0, stdout: `${manifest.version}\n` });
  });

  it('still refuses to open the interactive recorder without a terminal', async () => {
    const run = await pkg.run([]);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain('interactive terminal');
  });

  it.skipIf(process.platform === 'win32')(
    'cancels on SIGINT: closes the browser, exits 130 and says so',
    async () => {
      const running = pkg.start(['replay', 'typing', '-d', '8000-8000']);
      await running.waitForOutput('[2/4] goto');
      const startedAt = Date.now();
      running.child.kill('SIGINT');
      const run = await running.result;
      expect(run.code).toBe(130);
      expect(run.stderr).toContain('■ Typing flow cancelled');
      expect(run.stdout).not.toContain('✔');
      // Far less than the 8 s pause the replay was in the middle of.
      expect(Date.now() - startedAt).toBeLessThan(7000);
    },
  );

  it('leaves the real recordings folder as it found it', () => {
    // Other test files create and remove their own scratch folders there while
    // this one runs, so only the entries that are not theirs are compared.
    const after = realRecordings();
    for (const slug of ['typing', 'secret', 'unreachable']) {
      expect(after).not.toContain(slug);
    }
    const owned = recordingsBefore.filter(
      (name) => !TRANSIENT_FOLDER.test(name),
    );
    expect(after).toStrictEqual(expect.arrayContaining(owned));
  });
});
