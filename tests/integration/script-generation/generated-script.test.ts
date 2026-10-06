import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateScript } from '../../../src/script-generation/domain/generate-script.ts';
import type { Target } from '../../../src/shared/domain/locator.ts';
import type { RecordingEvent } from '../../../src/shared/domain/recording-event.ts';
import type { FixtureServer } from '../../support/fixture-server.ts';
import { startFixtureServer } from '../../support/fixture-server.ts';
import { recordingOf } from '../../support/golden-recordings.ts';
import { runNodeModule } from '../../support/run-node-module.ts';
import type { NodeRun } from '../../support/run-node-module.ts';
import { createScratchDir } from '../../support/scratch-root.ts';

const TIMING_TOLERANCE_MS = 100;
// The slow step (a click waiting for a button created 400 ms after load)
// finishes after ~1.4 s on a cold Windows runner, so the steps after it are
// scheduled far enough away to stay "on time" on any CI machine; the
// assertion is still about absolute offsets, not about machine speed.
const RELOAD_OFFSET_MS = 3000;
const GO_BACK_OFFSET_MS = 3500;
const HEADLESS = { BROWSER_RECORDER_HEADLESS: '1' };
const HUMAN_TIMING = {
  BROWSER_RECORDER_TIMING: 'human',
  BROWSER_RECORDER_HUMAN_DELAY: '10-20',
  BROWSER_RECORDER_SEED: '7',
};
const SETTLE_CAP_MS = 5000;
// A slow runner adds browser start-up and polling jitter on top of the cap.
const CAP_MARGIN_MS = 4000;

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
    // Inside the repository so `import 'patchright'` resolves like a replay.
    scratch = createScratchDir('script-generation-');
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
      { kind: 'reload', offsetMs: RELOAD_OFFSET_MS, pageId: 'page1' },
      { kind: 'go-back', offsetMs: GO_BACK_OFFSET_MS, pageId: 'page1' },
    ]);

    const byIndex = new Map(markers(run).map((m) => [m.index, m.elapsedMs]));
    expect(run.exitCode).toBe(0);
    expect([...byIndex.keys()]).toStrictEqual([0, 1, 2, 3, 4]);
    expect(byIndex.get(3)).toBeGreaterThanOrEqual(RELOAD_OFFSET_MS);
    expect(byIndex.get(3)).toBeLessThan(RELOAD_OFFSET_MS + TIMING_TOLERANCE_MS);
    expect(byIndex.get(4)).toBeGreaterThanOrEqual(GO_BACK_OFFSET_MS);
    expect(byIndex.get(4)).toBeLessThan(
      GO_BACK_OFFSET_MS + TIMING_TOLERANCE_MS,
    );
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

  describe('actions that settle after the last step', () => {
    const confirmClick: RecordingEvent = {
      kind: 'click',
      offsetMs: 100,
      pageId: 'page1',
      target: {
        locator: { kind: 'role', role: 'button', name: 'Confirmar' },
        nth: null,
        framePath: [],
        description: 'Confirmar',
      },
      button: 'left',
      modifiers: [],
    };

    function clickOn(
      locator: Target['locator'],
      offsetMs: number,
    ): RecordingEvent {
      return {
        kind: 'click',
        offsetMs,
        pageId: 'page1',
        target: { locator, nth: null, framePath: [], description: 'subject' },
        button: 'left',
        modifiers: [],
      };
    }

    function waitForSamePage(offsetMs: number, page: string): RecordingEvent {
      return {
        kind: 'wait-for-url',
        offsetMs,
        pageId: 'page1',
        url: server.urlFor(page),
      };
    }

    it('records the POST of the last click before the browser closes', async () => {
      server.clearReports();
      const run = await execute([
        FIRST_PAGE,
        goto(0, server.urlFor('confirm-modal.html')),
        confirmClick,
        waitForSamePage(150, 'confirm-modal.html'),
      ]);

      expect(run.stdout).not.toContain('::error');
      expect(run.exitCode).toBe(0);
      expect(server.reports()).toContain('confirmed');
    });

    it('reports the request of a last click that never navigates', async () => {
      server.clearReports();
      const run = await execute([
        FIRST_PAGE,
        goto(0, server.urlFor('fire-and-forget.html')),
        clickOn({ kind: 'role', role: 'button', name: 'Send' }, 100),
      ]);

      expect(run.stdout).not.toContain('::error');
      expect(run.exitCode).toBe(0);
      expect(server.reports()).toContain('sent');
    });

    it('settles after the same click in human timing too', async () => {
      server.clearReports();
      const run = await runNodeModule(
        generateScript(
          recordingOf([
            FIRST_PAGE,
            goto(0, server.urlFor('confirm-modal.html')),
            confirmClick,
            waitForSamePage(150, 'confirm-modal.html'),
          ]),
        ),
        {
          directory: scratch,
          env: { ...HEADLESS, ...HUMAN_TIMING },
          shouldCloseStdin: false,
        },
      );

      expect(run.stdout).not.toContain('::error');
      expect(run.exitCode).toBe(0);
      expect(server.reports()).toContain('confirmed');
    });

    it('finishes a page that never goes quiet at the cap, with a warning', async () => {
      const run = await execute([
        FIRST_PAGE,
        goto(0, server.urlFor('polling.html')),
      ]);

      const done = /^::done (\d+)$/mu.exec(run.stdout);
      const elapsedMs = Number(done?.[1]);
      expect(run.exitCode).toBe(0);
      expect(elapsedMs).toBeGreaterThanOrEqual(SETTLE_CAP_MS);
      expect(elapsedMs).toBeLessThan(SETTLE_CAP_MS + CAP_MARGIN_MS);
      expect(run.stdout).toMatch(
        /^::warn "Stopped waiting for the network after 5 s; \d+ requests? w(?:as|ere) still in flight"$/mu,
      );
    });

    it('does not settle when a step fails', async () => {
      const run = await execute([
        FIRST_PAGE,
        goto(0, server.urlFor('polling.html')),
        clickOn({ kind: 'label', text: 'Avatar' }, 100),
        {
          kind: 'set-input-files',
          offsetMs: 200,
          pageId: 'page1',
          fileNames: ['not-there.txt'],
        },
      ]);

      expect(run.stdout).toMatch(/^::error 3 ".*not-there\.txt.*"$/mu);
      expect(run.stdout).not.toContain('::warn');
      expect(run.stdout).not.toContain('::done');
      expect(run.exitCode).toBe(1);
    });

    it('keeps the settle and navigation runtime out of the page', () => {
      const script = generateScript(
        recordingOf([
          FIRST_PAGE,
          confirmClick,
          waitForSamePage(150, 'confirm-modal.html'),
        ]),
      );

      expect(script).not.toMatch(/Runtime\.enable|Console\.enable/u);
      expect(script).not.toMatch(
        /\.(?:evaluate|addInitScript|exposeFunction)\(/u,
      );
    });

    it('emits framenavigated for a reload of the same URL in Patchright', async () => {
      const url = server.urlFor('confirm-modal.html');
      const probe = `import { chromium } from 'patchright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(${JSON.stringify(url)});
const urls = [];
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) urls.push(frame.url());
});
await page.reload();
console.log(JSON.stringify(urls));
await browser.close();
`;
      const run = await runNodeModule(probe, {
        directory: scratch,
        env: HEADLESS,
        shouldCloseStdin: false,
      });

      expect(JSON.parse(run.stdout.trim())).toStrictEqual([url]);
    });
  });

  describe('scrolling', () => {
    interface Reported {
      readonly window: readonly number[];
      readonly panel: readonly number[];
      readonly spyCalls: number;
      readonly addedGlobals: readonly string[];
      readonly panelOwnProperties: readonly string[];
    }

    function scrollTo(
      offsetMs: number,
      target: Target | null,
      position: { x: number; y: number },
    ): RecordingEvent {
      return { kind: 'scroll', offsetMs, pageId: 'page1', target, ...position };
    }

    function css(selector: string, framePath: string[] = []): Target {
      return {
        locator: { kind: 'css', selector },
        nth: null,
        framePath,
        description: selector,
      };
    }

    const reportClick: RecordingEvent = {
      kind: 'click',
      offsetMs: 900,
      pageId: 'page1',
      target: css('#report'),
      button: 'left',
      modifiers: [],
    };

    async function replayScrolls(
      scrolls: readonly RecordingEvent[],
    ): Promise<{ run: NodeRun; outer: Reported; inner: Reported }> {
      server.clearReports();
      const run = await execute([
        FIRST_PAGE,
        goto(0, server.urlFor('scroll-replay.html')),
        ...scrolls,
        reportClick,
        // Keeps the browser open until the page's report request has gone out.
        scrollTo(1400, null, { x: 0, y: 0 }),
      ]);
      const [report] = server.reports();
      const state = JSON.parse(report) as {
        outer: Reported;
        inner: Reported;
      };
      return { run, ...state };
    }

    it('restores exact positions of the window, an element and an iframe element', async () => {
      const { run, outer, inner } = await replayScrolls([
        scrollTo(200, null, { x: 0, y: 713 }),
        scrollTo(300, css('#panel'), { x: 0, y: 333 }),
        scrollTo(400, css('#panel', ['iframe#inner']), { x: 0, y: 222 }),
      ]);

      expect(run.stdout).not.toContain('::error');
      expect(run.exitCode).toBe(0);
      expect(outer.window).toStrictEqual([0, 713]);
      expect(outer.panel).toStrictEqual([0, 333]);
      expect(inner.panel).toStrictEqual([0, 222]);
    });

    it('is exact for other positions too, despite smooth scrolling in the page', async () => {
      const { outer, inner } = await replayScrolls([
        scrollTo(200, null, { x: 0, y: 41 }),
        scrollTo(300, css('#panel'), { x: 0, y: 7 }),
        scrollTo(400, css('#panel', ['iframe#inner']), { x: 0, y: 500 }),
      ]);

      expect(outer.window).toStrictEqual([0, 41]);
      expect(outer.panel).toStrictEqual([0, 7]);
      expect(inner.panel).toStrictEqual([0, 500]);
    });

    it('runs nothing in the main world: no page API call, no new global or property', async () => {
      const { outer, inner } = await replayScrolls([
        scrollTo(200, null, { x: 0, y: 713 }),
        scrollTo(300, css('#panel'), { x: 0, y: 333 }),
        scrollTo(400, css('#panel', ['iframe#inner']), { x: 0, y: 222 }),
      ]);

      expect(outer.window).toStrictEqual([0, 713]);
      expect(outer.spyCalls).toBe(0);
      expect(inner.spyCalls).toBe(0);
      expect(outer.addedGlobals).toStrictEqual([]);
      expect(inner.addedGlobals).toStrictEqual([]);
      expect(outer.panelOwnProperties).toStrictEqual([]);
      expect(inner.panelOwnProperties).toStrictEqual([]);
    });

    describe('inside shadow trees', () => {
      interface ShadowReport {
        readonly box: readonly number[];
        readonly deep: readonly number[];
        readonly spyCalls: number;
        readonly addedGlobals: readonly string[];
        readonly deepOwnProperties: readonly string[];
      }

      async function replayShadowScrolls(
        scrolls: readonly RecordingEvent[],
      ): Promise<{ run: NodeRun; report: ShadowReport }> {
        server.clearReports();
        const run = await execute([
          FIRST_PAGE,
          goto(0, server.urlFor('scroll-shadow.html')),
          ...scrolls,
          reportClick,
          scrollTo(1400, null, { x: 0, y: 0 }),
        ]);
        const [text] = server.reports();
        return { run, report: JSON.parse(text) as ShadowReport };
      }

      it('restores the exact position of elements in open and nested shadow roots', async () => {
        const { run, report } = await replayShadowScrolls([
          scrollTo(200, css('#box'), { x: 0, y: 333 }),
          scrollTo(300, css('#deep'), { x: 0, y: 217 }),
        ]);

        expect(run.stdout).not.toContain('::error');
        expect(run.exitCode).toBe(0);
        expect(report.box).toStrictEqual([0, 333]);
        expect(report.deep).toStrictEqual([0, 217]);
      });

      it('runs nothing in the main world: no page API call, no new global or property', async () => {
        const { report } = await replayShadowScrolls([
          scrollTo(200, css('#deep'), { x: 0, y: 217 }),
        ]);

        expect(report.deep).toStrictEqual([0, 217]);
        expect(report.spyCalls).toBe(0);
        expect(report.addedGlobals).toStrictEqual([]);
        expect(report.deepOwnProperties).toStrictEqual([]);
      });
    });
  });
});
