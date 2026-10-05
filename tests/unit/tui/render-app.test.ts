import { describe, expect, it } from 'vitest';

import type { AppState, Screen } from '../../../src/tui/domain/app-state.ts';
import { initialState } from '../../../src/tui/domain/app-reducer.ts';
import { cellWidth, stripAnsi } from '../../../src/tui/render/layout.ts';
import { toFrameText } from '../../../src/tui/render/frame-text.ts';
import { renderApp } from '../../../src/tui/render/render-app.ts';
import {
  clicks,
  newRecordingScreen,
  validEntry,
} from '../../support/tui-fixtures.ts';
import { BRAVE_CHOICE } from '../../support/browser-fixtures.ts';

const SIZE = { columns: 80, rows: 24 };

function on(screen: Screen, nowMs = 0): AppState {
  return { ...initialState(), screen, nowMs };
}

const library: Screen = {
  kind: 'library',
  entries: [
    validEntry('checkout', 'Checkout flow'),
    validEntry('login', 'Login', { durationMs: 12_000, stepCount: 3 }),
  ],
  cursor: { selected: 0, top: 0 },
  mode: { kind: 'browse' },
  error: null,
};

const everyScreen: Screen[] = [
  initialState().screen,
  { kind: 'main-menu', selected: 0 },
  newRecordingScreen(),
  library,
];

describe('src/tui/render/render-app.ts', () => {
  it('never mentions the old engine name on any screen', () => {
    const failedSetup: Screen = {
      kind: 'setup',
      phase: 'failed',
      lines: [],
      manualCommand: 'pnpm exec patchright install chromium',
      exitCode: 1,
    };
    for (const screen of [...everyScreen, failedSetup]) {
      const text = renderApp(on(screen), SIZE, false).join('\n');
      expect(text.toLowerCase()).not.toContain('playwright');
    }
    expect(renderApp(on(failedSetup), SIZE, false).join('\n')).toContain(
      'patchright install chromium',
    );
  });

  it('renders the main menu as an 80x24 frame', () => {
    expect(
      renderApp(on({ kind: 'main-menu', selected: 0 }), SIZE, false).join('\n'),
    ).toMatchInlineSnapshot(`
      "╭─ browser-recorder ───────────────────────────────────────────────────────────╮
      │                                                                              │
      │   Record a browser session, replay it as a Patchright script.                │
      │                                                                              │
      │   ❯ New recording                                                            │
      │     Library                                                                  │
      │     Quit                                                                     │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
       ↑↓ move  enter select  q quit                                                  "
    `);
  });

  it('renders the library as an 80x24 frame', () => {
    expect(renderApp(on(library), SIZE, false).join('\n'))
      .toMatchInlineSnapshot(`
      "╭─ Library ────────────────────────────────────────────────────────────────────╮
      │   Name                                       Created          Duration Steps │
      │                                                                          1/2 │
      │ ❯ Checkout flow                              2026-10-05 12:30     1:05     7 │
      │   Login                                      2026-10-05 12:30     0:12     3 │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
       ↑↓ move  enter replay  t timeline  r rename  d delete  n new  esc back         "
    `);
  });

  it('renders an empty library with the new hint', () => {
    const empty: Screen = { ...library, entries: [] };
    expect(renderApp(on(empty), SIZE, false).join('\n')).toContain(
      'Press n to create your first recording.',
    );
  });

  it('renders a replay with the running step highlighted at 80x24', () => {
    const screen: Screen = {
      kind: 'replay',
      browser: BRAVE_CHOICE,
      warnings: [],
      name: 'Checkout flow',
      events: clicks(6),
      startedAtMs: 0,
      view: {
        status: 'running',
        errorMessage: null,
        steps: [
          { index: 0, status: 'done', driftMs: 2 },
          { index: 1, status: 'done', driftMs: 5 },
          { index: 2, status: 'running', driftMs: null },
          { index: 3, status: 'pending', driftMs: null },
        ],
      },
    };
    expect(renderApp(on(screen, 4200), SIZE, false).join('\n'))
      .toMatchInlineSnapshot(`
        "╭─ Replay · Checkout flow ─────────────────────────────────────────────────────╮
        │ ▶ Running                                                00:04.200  step 3/6 │
        │ Brave · managed                                                              │
        │ ──────────────────────────────────────────────────────────────────────────── │
        │ ✓ +00:00.000        click         Step 0                                +2ms │
        │ ✓ +00:01.000 ━━━    click         Step 1                                +5ms │
        │ ▶ +00:02.000 ━━━    click         Step 2                                     │
        │ · +00:03.000 ━━━    click         Step 3                                     │
        │ · +00:04.000 ━━━    click         Step 4                                     │
        │ · +00:05.000 ━━━    click         Step 5                                     │
        │                                                                              │
        │                                                                              │
        │                                                                              │
        │                                                                              │
        │                                                                              │
        │                                                                              │
        │                                                                              │
        │                                                                              │
        │                                                                              │
        │                                                                              │
        │                                                                              │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
         c cancel                                                                       "
      `);
  });

  it('is a pure function of state and size', () => {
    const state = on(library, 123);
    expect(renderApp(state, SIZE, true)).toEqual(renderApp(state, SIZE, true));
  });

  it('fills exactly the terminal: one line per row, every line one terminal wide', () => {
    for (const screen of everyScreen) {
      for (const size of [
        SIZE,
        { columns: 120, rows: 40 },
        { columns: 44, rows: 12 },
      ]) {
        const lines = renderApp(on(screen), size, true);
        expect(lines).toHaveLength(size.rows);
        expect(lines.map(cellWidth)).toEqual(
          Array.from({ length: size.rows }, () => size.columns),
        );
      }
    }
  });

  it('draws no escape sequence when color is off', () => {
    for (const screen of everyScreen) {
      expect(renderApp(on(screen), SIZE, false).join('')).not.toContain(
        '\u001b',
      );
    }
  });

  it('draws the same text with and without color', () => {
    const colored = renderApp(on(library), SIZE, true).map(stripAnsi);
    expect(colored.join('\n')).toContain('Checkout flow');
    expect(colored.join('\n')).toContain('╭─ Library');
  });

  it('fits a resized terminal and keeps the selection visible', () => {
    const entries = Array.from({ length: 30 }, (_, i) =>
      validEntry(`r${String(i)}`, `Rec ${String(i)}`),
    );
    const state = on({
      ...library,
      entries,
      cursor: { selected: 20, top: 0 },
    });
    const small = renderApp(state, { columns: 60, rows: 12 }, false);
    expect(small).toHaveLength(12);
    expect(small.join('\n')).toContain('Rec 20');
    const big = renderApp(state, { columns: 100, rows: 40 }, false);
    expect(big).toHaveLength(40);
    expect(big.join('\n')).toContain('Rec 20');
    expect(big.join('\n')).toContain('Rec 0');
  });

  it('asks for a bigger terminal instead of breaking the layout', () => {
    const lines = renderApp(on(library), { columns: 30, rows: 8 }, false);
    expect(lines).toHaveLength(8);
    expect(lines.join('\n')).toContain('Terminal too small');
    expect(lines.map(cellWidth)).toEqual(Array.from({ length: 8 }, () => 30));
  });

  it('puts the key hints of the screen on the last row', () => {
    const lines = renderApp(
      on({ kind: 'main-menu', selected: 0 }),
      SIZE,
      false,
    );
    expect(lines.at(-1)).toContain('↑↓ move');
    expect(lines.at(-1)).toContain('q quit');
  });
});

describe('src/tui/render/frame-text.ts', () => {
  it('writes from the home position and clears the rest of every line', () => {
    expect(toFrameText(['one', 'two'])).toBe(
      '\u001b[H' + 'one\u001b[K\r\ntwo\u001b[K' + '\u001b[J',
    );
  });

  it('does not end the last line with a newline, so the terminal never scrolls', () => {
    expect(toFrameText(['only']).endsWith('\r\n\u001b[J')).toBe(false);
    expect(toFrameText([])).toBe('\u001b[H\u001b[J');
  });
});
