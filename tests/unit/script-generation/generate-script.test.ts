import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { generateScript } from '../../../src/script-generation/domain/generate-script.ts';
import type { RecordingEvent } from '../../../src/shared/domain/recording-event.ts';
import {
  BASIC_RECORDING,
  HOSTILE_RECORDING,
  HOSTILE_VALUE,
  MULTI_TAB_RECORDING,
  recordingOf,
} from '../../support/golden-recordings.ts';
import { checkModuleSyntax } from '../../support/node-check.ts';

const GOLDENS = path.join(import.meta.dirname, 'goldens');
const IMPORT_SOURCE = /^import\b[^'"]*['"]([^'"]+)['"]/gmu;

function golden(name: string): string {
  return readFileSync(path.join(GOLDENS, name), 'utf8');
}

function importedModules(script: string): string[] {
  return [...script.matchAll(IMPORT_SOURCE)].map((match) => match[1]);
}

const BRAVE_MANAGED = recordingOf(BASIC_RECORDING.events, {
  browser: { browserId: 'brave', profileMode: 'managed', sourceProfile: null },
});
const LEGACY_EMULATED = recordingOf(BASIC_RECORDING.events, {
  display: { kind: 'emulated', width: 800, height: 600 },
});

const CASES = [
  ['basic.mjs', BASIC_RECORDING],
  ['brave-managed.mjs', BRAVE_MANAGED],
  ['legacy-emulated.mjs', LEGACY_EMULATED],
  ['multi-tab.mjs', MULTI_TAB_RECORDING],
  ['hostile.mjs', HOSTILE_RECORDING],
] as const;

describe('src/script-generation/domain/generate-script.ts', () => {
  it.each(CASES)(
    'matches the golden script %s byte for byte',
    (name, recording) => {
      expect(generateScript(recording)).toBe(golden(name));
    },
  );

  it.each(CASES)(
    'never runs code in the page main world in %s',
    (_name, recording) => {
      const script = generateScript(recording);
      expect(script).not.toMatch(
        /\.(?:evaluate|evaluateHandle|evaluateAll|\$eval|\$\$eval|waitForFunction|addInitScript|addScriptTag|exposeFunction|exposeBinding)\(/u,
      );
    },
  );

  it.each(CASES)(
    'sends no enable call of the Runtime or Console domains in %s',
    (_name, recording) => {
      const forbidden = new RegExp(
        ['Runtime', 'Console'].map((domain) => `${domain}\\.enable`).join('|'),
        'u',
      );
      expect(generateScript(recording)).not.toMatch(forbidden);
    },
  );

  it('scrolls through the isolated-world runtime helper only', () => {
    const script = generateScript(BASIC_RECORDING);
    expect(script).toContain('await rt.scrollTo(page1, [], [0, 640]);');
    expect(script).toContain('worldName: SCROLL_WORLD');
    expect(script).toContain("'Runtime.callFunctionOn'");
  });

  it.each(CASES)(
    'produces a parseable ES module for %s',
    (_name, recording) => {
      expect(checkModuleSyntax(generateScript(recording))).toStrictEqual({
        isValid: true,
        stderr: '',
      });
    },
  );

  it.each(CASES)(
    'is byte-identical when generated twice for %s',
    (_name, recording) => {
      expect(generateScript(recording)).toBe(generateScript(recording));
    },
  );

  it.each(CASES)(
    'imports only patchright and node builtins in %s',
    (_name, recording) => {
      const modules = importedModules(generateScript(recording));
      expect(modules).toContain('patchright');
      expect(
        modules.filter(
          (name) => name !== 'patchright' && !name.startsWith('node:'),
        ),
      ).toStrictEqual([]);
    },
  );

  it.each(['recorded', 'human', 'banana'])(
    'is byte-identical whatever the timing environment says (%s)',
    (mode) => {
      const before = generateScript(BASIC_RECORDING);
      vi.stubEnv('BROWSER_RECORDER_TIMING', mode);
      vi.stubEnv('BROWSER_RECORDER_HUMAN_DELAY', '1-2');
      vi.stubEnv('BROWSER_RECORDER_SEED', '9');
      try {
        expect(generateScript(BASIC_RECORDING)).toBe(before);
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it('schedules every step at its recorded absolute offset', () => {
    const script = generateScript(BASIC_RECORDING);
    const offsets = [
      ...script.matchAll(
        /await rt\.at\((\d+)(?:, \{ isFollowUp: true \})?\); rt\.mark\((\d+)\);/gu,
      ),
    ].map((match) => [Number(match[1]), Number(match[2])]);
    expect(offsets).toStrictEqual(
      BASIC_RECORDING.events.map((event, index) => [event.offsetMs, index]),
    );
  });

  it('marks only the steps that observe a consequence as follow-ups', () => {
    const base = { pageId: 'page1' } as const;
    const script = generateScript(
      recordingOf([
        {
          ...base,
          kind: 'page-opened',
          offsetMs: 0,
          openerPageId: null,
          cause: 'user',
          url: 'about:blank',
        },
        { ...base, kind: 'goto', offsetMs: 0, url: 'https://example.com/' },
        {
          ...base,
          kind: 'wait-for-url',
          offsetMs: 100,
          url: 'https://example.com/a',
        },
        {
          ...base,
          kind: 'dialog',
          offsetMs: 200,
          dialogType: 'alert',
          message: 'hi',
          action: 'accept',
          promptText: null,
        },
        {
          ...base,
          kind: 'set-input-files',
          offsetMs: 300,
          fileNames: ['a.txt'],
        },
        { ...base, kind: 'reload', offsetMs: 400 },
        {
          ...base,
          pageId: 'page2',
          kind: 'page-opened',
          offsetMs: 500,
          openerPageId: 'page1',
          cause: 'action',
          url: 'https://example.com/b',
        },
        {
          ...base,
          pageId: 'page3',
          kind: 'page-opened',
          offsetMs: 600,
          openerPageId: 'page1',
          cause: 'user',
          url: 'https://example.com/c',
        },
      ] as never),
    );
    const follow = [
      ...script.matchAll(
        /await rt\.at\((\d+)(?<followUp>, \{ isFollowUp: true \})?\);/gu,
      ),
    ].map((match) => [
      Number(match[1]),
      match.groups?.['followUp'] !== undefined,
    ]);
    expect(follow).toStrictEqual([
      [0, true],
      [0, false],
      [100, true],
      [200, true],
      [300, true],
      [400, false],
      [500, true],
      [600, false],
    ]);
  });

  it('starts the clock after the first page exists and finishes with done', () => {
    const script = generateScript(BASIC_RECORDING);
    const lines = script.split('\n').map((line) => line.trim());
    expect(
      lines.indexOf(
        'const page1 = context.pages()[0] ?? (await context.newPage());',
      ),
    ).toBeLessThan(lines.indexOf('rt.start();'));
    expect(lines).toContain('rt.done();');
    expect(lines).toContain(
      '} catch (error) { rt.fail(error); } finally { await close(); }',
    );
  });

  it('settles the network after the last step and only on the success path', () => {
    const lines = generateScript(BASIC_RECORDING)
      .split('\n')
      .map((line) => line.trim());
    const settleAt = lines.indexOf('await rt.settle();');
    expect(settleAt).toBeGreaterThan(lines.indexOf('rt.start();'));
    expect(lines[settleAt + 1]).toBe('rt.done();');
    expect(lines.filter((line) => line.includes('rt.settle()'))).toHaveLength(
      1,
    );
    expect(
      lines.indexOf(
        '} catch (error) { rt.fail(error); } finally { await close(); }',
      ),
    ).toBeGreaterThan(settleAt);
  });

  it('settles even when the recording has no steps', () => {
    expect(generateScript(recordingOf([]))).toContain(
      'await rt.settle();\n  rt.done();',
    );
  });

  it('reuses the page the persistent context opens instead of a second tab', () => {
    const script = generateScript(BASIC_RECORDING);
    expect(script).toContain('context.pages()[0] ?? (await context.newPage())');
    expect(script).not.toContain('const page1 = await context.newPage();');
  });

  it('opens the context from the recorded window display', () => {
    const script = generateScript(BASIC_RECORDING);
    expect(script).toContain(
      'await openContext(chromium, { kind: "window", width: 1280, height: 800 })',
    );
  });

  it('opens the context from the recorded emulated display', () => {
    const script = generateScript(
      recordingOf([], {
        display: { kind: 'emulated', width: 800, height: 600 },
      }),
    );
    expect(script).toContain(
      'await openContext(chromium, { kind: "emulated", width: 800, height: 600 })',
    );
  });

  it('launches through the persistent context and no throwaway browser', () => {
    const script = generateScript(BASIC_RECORDING);
    expect(script).toContain('launchPersistentContext(');
    expect(script).not.toContain('chromium.launch(');
    expect(script).not.toContain('browser.newContext');
    expect(script).not.toContain('browser.close');
  });

  it.each([
    [
      { browserId: 'brave', profileMode: 'managed', sourceProfile: null },
      'brave, managed profile',
    ],
    [
      {
        browserId: 'chrome',
        profileMode: 'copy-of-real',
        sourceProfile: 'Profile 2',
      },
      'chrome, copy-of-real profile',
    ],
    [
      { browserId: 'bundled', profileMode: 'ephemeral', sourceProfile: null },
      'bundled, ephemeral profile',
    ],
  ] as const)(
    'names the recorded browser and mode in the header for %j',
    (browser, text) => {
      const script = generateScript(recordingOf([], { browser }));
      expect(script.split('\n')[1]).toBe(`// Recorded with: ${text}.`);
    },
  );

  it('never lets a hand-edited browser id break out of the header comment', () => {
    const script = generateScript(
      recordingOf([], {
        browser: {
          browserId: 'x\nprocess.exit(1)' as never,
          profileMode: 'managed',
          sourceProfile: null,
        },
      }),
    );
    expect(script).not.toContain('process.exit(1)');
    expect(script.split('\n')[1]).toBe(
      '// Recorded with: unknown browser, managed profile.',
    );
  });

  it('reads as bundled and ephemeral for a recording migrated from version 1', () => {
    const script = generateScript(
      recordingOf([], {
        display: { kind: 'emulated', width: 1280, height: 800 },
      }),
    );
    expect(script.split('\n')[1]).toBe(
      '// Recorded with: bundled, ephemeral profile.',
    );
  });

  it('registers dialog and file queues on the page that owns them', () => {
    const script = generateScript(MULTI_TAB_RECORDING);
    expect(script).toContain(
      'rt.expectDialogs(page1, [{ index: 3, action: "accept", promptText: "Ana" }]);',
    );
    expect(script).toContain(
      'rt.expectFiles(page1, [{ index: 5, fileNames: ["report.pdf", "photo.png"] }]);',
    );
    expect(script).toContain(
      'rt.expectDialogs(page2, [{ index: 8, action: "dismiss", promptText: null }]);',
    );
  });

  it('never leaks a recorded value outside a string literal', () => {
    const script = generateScript(HOSTILE_RECORDING);
    expect(script).not.toContain(`(${HOSTILE_VALUE})`);
    expect(script).toContain('\\"); process.exit(1); (\\"');
  });

  it('does not put the recording name into the script', () => {
    expect(generateScript(HOSTILE_RECORDING)).not.toContain('evil');
  });

  it('throws naming the unsupported type and index, producing nothing', () => {
    const events = [
      ...BASIC_RECORDING.events.slice(0, 2),
      {
        kind: 'teleport',
        offsetMs: 900,
        pageId: 'page1',
      } as unknown as RecordingEvent,
    ];
    expect(() => generateScript(recordingOf(events))).toThrow(
      'Unsupported event type "teleport" at index 2',
    );
  });

  it('rejects a display that is not finite numbers', () => {
    const recording = recordingOf([], {
      display: { kind: 'window', width: Number.NaN, height: 1 },
    });
    expect(() => generateScript(recording)).toThrow(/finite/);
  });
});
