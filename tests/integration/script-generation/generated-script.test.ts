import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateScript } from '../../../src/script-generation/domain/generate-script.ts';
import type { RecordingEvent } from '../../../src/shared/domain/recording-event.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';
import { recordingOf } from '../../support/golden-recordings.ts';
import { runNodeModule } from '../../support/run-node-module.ts';
import type { NodeRun } from '../../support/run-node-module.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const SCRATCH_PARENT = path.join(ROOT, 'recordings');
const TIMING_TOLERANCE_MS = 100;
const HEADLESS = { BROWSER_RECORDER_HEADLESS: '1' };

const FIRST_PAGE: RecordingEvent = {
  kind: 'page-opened',
  offsetMs: 0,
  pageId: 'page1',
  openerPageId: null,
  cause: 'user',
  url: 'about:blank',
};

function goto(offsetMs: number, url: string): RecordingEvent {
  return { kind: 'goto', offsetMs, pageId: 'page1', url };
}

function markers(run: NodeRun): { index: number; elapsedMs: number }[] {
  return [...run.stdout.matchAll(/^::step (\d+) (\d+)$/gmu)].map((match) => ({
    index: Number(match[1]),
    elapsedMs: Number(match[2]),
  }));
}

describe('generated script against the fixture site', () => {
  let server: FixtureServer;
  let scratch: string;

  beforeAll(async () => {
    server = await startFixtureServer();
    // Inside the repository so `import 'playwright'` resolves like a replay.
    mkdirSync(SCRATCH_PARENT, { recursive: true });
    scratch = mkdtempSync(path.join(SCRATCH_PARENT, 'script-generation-'));
  });

  afterAll(async () => {
    await server.close();
    rmSync(scratch, { recursive: true, force: true });
  });

  function execute(
    events: readonly RecordingEvent[],
    files: Readonly<Record<string, string>> = {},
  ): Promise<NodeRun> {
    return runNodeModule(generateScript(recordingOf(events)), {
      directory: scratch,
      files,
      env: HEADLESS,
      shouldCloseStdin: false,
    });
  }

  it('absorbs a slow step instead of shifting the steps after it', async () => {
    const run = await execute([
      FIRST_PAGE,
      goto(0, server.urlFor('delayed-button.html')),
      {
        kind: 'click',
        offsetMs: 100,
        pageId: 'page1',
        target: {
          locator: { kind: 'role', role: 'button', name: 'Late arrival' },
          nth: null,
          framePath: [],
          description: 'Late arrival',
        },
        button: 'left',
        modifiers: [],
      },
      { kind: 'reload', offsetMs: 1000, pageId: 'page1' },
      { kind: 'go-back', offsetMs: 1500, pageId: 'page1' },
    ]);

    const byIndex = new Map(markers(run).map((m) => [m.index, m.elapsedMs]));
    expect(run.exitCode).toBe(0);
    expect([...byIndex.keys()]).toStrictEqual([0, 1, 2, 3, 4]);
    expect(byIndex.get(3)).toBeGreaterThanOrEqual(1000);
    expect(byIndex.get(3)).toBeLessThan(1000 + TIMING_TOLERANCE_MS);
    expect(byIndex.get(4)).toBeGreaterThanOrEqual(1500);
    expect(byIndex.get(4)).toBeLessThan(1500 + TIMING_TOLERANCE_MS);
    expect(run.stdout).toMatch(/^::done \d+$/mu);
  });

  it('answers the file chooser from the recording files directory', async () => {
    const run = await execute(
      [
        FIRST_PAGE,
        goto(0, server.urlFor('file-input.html')),
        {
          kind: 'click',
          offsetMs: 100,
          pageId: 'page1',
          target: {
            locator: { kind: 'label', text: 'Avatar' },
            nth: null,
            framePath: [],
            description: 'Avatar',
          },
          button: 'left',
          modifiers: [],
        },
        {
          kind: 'set-input-files',
          offsetMs: 200,
          pageId: 'page1',
          fileNames: ['avatar.txt'],
        },
      ],
      { 'files/avatar.txt': 'hello' },
    );

    expect(run.stdout).not.toContain('::error');
    expect(run.exitCode).toBe(0);
  });

  it('fails the step with an error marker when a recorded file is missing', async () => {
    const run = await execute([
      FIRST_PAGE,
      goto(0, server.urlFor('file-input.html')),
      {
        kind: 'click',
        offsetMs: 100,
        pageId: 'page1',
        target: {
          locator: { kind: 'label', text: 'Avatar' },
          nth: null,
          framePath: [],
          description: 'Avatar',
        },
        button: 'left',
        modifiers: [],
      },
      {
        kind: 'set-input-files',
        offsetMs: 200,
        pageId: 'page1',
        fileNames: ['not-there.txt'],
      },
    ]);

    expect(run.stdout).toMatch(/^::error 3 ".*not-there\.txt.*"$/mu);
    expect(run.exitCode).toBe(1);
  });

  it('handles a recorded dialog and a popup tab in order', async () => {
    const run = await execute([
      FIRST_PAGE,
      goto(0, server.urlFor('prompt-dialog.html')),
      {
        kind: 'click',
        offsetMs: 100,
        pageId: 'page1',
        target: {
          locator: { kind: 'css', selector: '#ask-name' },
          nth: null,
          framePath: [],
          description: 'Ask name',
        },
        button: 'left',
        modifiers: [],
      },
      {
        kind: 'dialog',
        offsetMs: 200,
        pageId: 'page1',
        dialogType: 'prompt',
        message: 'Your name?',
        action: 'accept',
        promptText: 'Ana',
      },
    ]);

    expect(markers(run).map((m) => m.index)).toStrictEqual([0, 1, 2, 3]);
    expect(run.exitCode).toBe(0);
  });
});
