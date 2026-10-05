import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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

const CASES = [
  ['basic.mjs', BASIC_RECORDING],
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
    'imports only playwright and node builtins in %s',
    (_name, recording) => {
      const modules = importedModules(generateScript(recording));
      expect(modules).toContain('playwright');
      expect(
        modules.filter(
          (name) => name !== 'playwright' && !name.startsWith('node:'),
        ),
      ).toStrictEqual([]);
    },
  );

  it('schedules every step at its recorded absolute offset', () => {
    const script = generateScript(BASIC_RECORDING);
    const offsets = [
      ...script.matchAll(/await rt\.at\((\d+)\); rt\.mark\((\d+)\);/gu),
    ].map((match) => [Number(match[1]), Number(match[2])]);
    expect(offsets).toStrictEqual(
      BASIC_RECORDING.events.map((event, index) => [event.offsetMs, index]),
    );
  });

  it('starts the clock after the first page exists and finishes with done', () => {
    const script = generateScript(BASIC_RECORDING);
    const lines = script.split('\n').map((line) => line.trim());
    expect(
      lines.indexOf('const page1 = await context.newPage();'),
    ).toBeLessThan(lines.indexOf('rt.start();'));
    expect(lines).toContain('rt.done();');
    expect(lines).toContain(
      '} catch (error) { rt.fail(error); } finally { await browser.close(); }',
    );
  });

  it('uses the recorded viewport', () => {
    const script = generateScript(
      recordingOf([], { viewport: { width: 800, height: 600 } }),
    );
    expect(script).toContain('viewport: { width: 800, height: 600 }');
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

  it('rejects a viewport that is not finite numbers', () => {
    const recording = recordingOf([], {
      viewport: { width: Number.NaN, height: 1 },
    });
    expect(() => generateScript(recording)).toThrow(/finite/);
  });
});
