import { describe, expect, it } from 'vitest';

import {
  RECORDED_TIMING,
  humanTiming,
} from '../../../src/shared/domain/replay-timing.ts';
import type {
  ChangeBrowserMode,
  LibraryScreen,
} from '../../../src/tui/domain/app-state.ts';
import type { LibraryEntryView } from '../../../src/tui/domain/app-views.ts';
import { emptyField } from '../../../src/tui/domain/text-input.ts';
import { createStyle } from '../../../src/tui/render/ansi.ts';
import { cellWidth } from '../../../src/tui/render/layout.ts';
import { renderLibraryScreen } from '../../../src/tui/render/screens/library-screen.ts';
import type { ScreenView } from '../../../src/tui/render/screen-view.ts';
import { plainContext } from '../../support/render-context.ts';
import { BRAVE_CHOICE } from '../../support/browser-fixtures.ts';
import { BROWSER_VIEWS, validEntry } from '../../support/tui-fixtures.ts';

function screen(
  entries: readonly LibraryEntryView[],
  selected = 0,
  top = 0,
): LibraryScreen {
  return {
    kind: 'library',
    entries,
    cursor: { selected, top },
    mode: { kind: 'browse' },
    error: null,
    timing: RECORDED_TIMING,
  };
}

describe('src/tui/render/screens/library-screen.ts', () => {
  it('shows an empty state with the new hint', () => {
    const view = renderLibraryScreen(screen([]), plainContext());
    const text = view.body.join('\n');
    expect(text).toContain('No recordings yet.');
    expect(text).toContain('Press n to create your first recording.');
  });

  it('drops replay and new from the hints while the browser is unavailable', () => {
    const keys = (isBrowserAvailable: boolean): string[] =>
      renderLibraryScreen(
        screen([validEntry('a', 'Alpha')]),
        plainContext({ isBrowserAvailable }),
      ).hints.map((hint) => hint.key);
    expect(keys(true)).toEqual([
      '↑↓',
      'enter',
      'h',
      't',
      'r',
      'b',
      'd',
      'n',
      'esc',
    ]);
    expect(keys(false)).toEqual(['↑↓', 't', 'r', 'b', 'd', 'esc']);
  });

  it('shows the replay timing mode next to the position', () => {
    const recorded = renderLibraryScreen(
      screen([validEntry('a', 'Alpha')]),
      plainContext(),
    );
    const human = renderLibraryScreen(
      {
        ...screen([validEntry('a', 'Alpha')]),
        timing: humanTiming({ minMs: 10, maxMs: 20 }),
      },
      plainContext(),
    );
    expect(recorded.body.join('\n')).toContain('recorded timing');
    expect(human.body.join('\n')).toContain('human timing 10-20 ms');
  });

  it('labels the timing key in the hints', () => {
    const hints = renderLibraryScreen(
      screen([validEntry('a', 'Alpha')]),
      plainContext(),
    ).hints;
    expect(hints.find((hint) => hint.key === 'h')).toStrictEqual({
      key: 'h',
      label: 'mode',
    });
  });

  it('explains the empty library without offering to record while offline', () => {
    const text = renderLibraryScreen(
      screen([]),
      plainContext({ isBrowserAvailable: false }),
    ).body.join('\n');
    expect(text).toContain('No recordings yet.');
    expect(text).not.toContain('Press n');
  });

  it('lists name, creation date, duration and steps', () => {
    const view = renderLibraryScreen(
      screen([validEntry('a', 'Checkout')]),
      plainContext(),
    );
    const row = view.body.find((line) => line.includes('Checkout')) ?? '';
    expect(row).toContain('2026-10-05 12:30');
    expect(row).toContain('1:05');
    expect(row).toContain('7');
    expect(view.body.join('\n')).toContain('Name');
  });

  it('lists the browser and profile mode of each recording', () => {
    const view = renderLibraryScreen(
      screen([
        validEntry('a', 'Alpha', { browser: BRAVE_CHOICE }),
        validEntry('b', 'Beta', {
          browser: {
            browserId: 'chrome',
            profileMode: 'copy-of-real',
            sourceProfile: 'Profile 2',
          },
        }),
        validEntry('c', 'Gamma'),
      ]),
      plainContext(),
    );
    const row = (name: string): string =>
      view.body.find((line) => line.includes(name)) ?? '';
    expect(view.body.join('\n')).toContain('Browser');
    expect(row('Alpha')).toContain('Brave · managed');
    expect(row('Beta')).toContain('Chrome · copy o…');
    expect(row('Gamma')).not.toContain('·');
  });

  it('drops the browser column on a narrow terminal so names keep room', () => {
    const view = renderLibraryScreen(
      screen([validEntry('a', 'Alpha', { browser: BRAVE_CHOICE })]),
      plainContext({ width: 60 }),
    );
    expect(view.body.join('\n')).not.toContain('Brave');
    expect(view.body.join('\n')).toContain('Alpha');
  });

  it('marks the selected row', () => {
    const entries = [validEntry('a', 'Alpha'), validEntry('b', 'Beta')];
    const lines = renderLibraryScreen(screen(entries, 1), plainContext()).body;
    expect(lines.find((line) => line.includes('Beta'))?.startsWith('❯')).toBe(
      true,
    );
    expect(lines.find((line) => line.includes('Alpha'))?.startsWith(' ')).toBe(
      true,
    );
  });

  it('highlights the selected row with reverse video when color is on', () => {
    const lines = renderLibraryScreen(
      screen([validEntry('a', 'Alpha')]),
      plainContext({ style: createStyle(true) }),
    ).body;
    expect(
      lines.find((line) => line.includes('Alpha'))?.startsWith('\u001b[7m'),
    ).toBe(true);
  });

  it('lists a corrupt entry as invalid with its reason', () => {
    const entries: LibraryEntryView[] = [
      { kind: 'invalid', slug: 'broken', reason: 'Unexpected token' },
    ];
    const text = renderLibraryScreen(screen(entries), plainContext()).body.join(
      '\n',
    );
    expect(text).toContain('✖ broken');
    expect(text).toContain('Unexpected token');
  });

  it('scrolls so the selection stays visible and shows the position', () => {
    const entries = Array.from({ length: 30 }, (_, i) =>
      validEntry(`r${String(i)}`, `Rec ${String(i)}`),
    );
    const view = renderLibraryScreen(
      screen(entries, 25, 0),
      plainContext({ height: 8 }),
    );
    const text = view.body.join('\n');
    expect(text).toContain('Rec 25');
    expect(text).not.toContain('Rec 0 ');
    expect(text).toContain('26/30');
    expect(view.body.length).toBeLessThanOrEqual(8);
  });

  it('drops the date column on a narrow terminal', () => {
    const view = renderLibraryScreen(
      screen([validEntry('a', 'Checkout')]),
      plainContext({ width: 40 }),
    );
    const row = view.body.find((line) => line.includes('Checkout')) ?? '';
    expect(row).not.toContain('2026-10-05');
    expect(row).toContain('1:05');
    expect(view.body.every((line) => cellWidth(line) <= 40)).toBe(true);
  });

  it('shows the rename field inline', () => {
    const renaming: LibraryScreen = {
      ...screen([validEntry('a', 'Alpha')]),
      mode: { kind: 'rename', field: emptyField('Alpha 2') },
    };
    const view = renderLibraryScreen(renaming, plainContext());
    expect(view.body.join('\n')).toContain('Rename: Alpha 2▏');
    expect(view.hints.map((hint) => hint.key)).toEqual(['enter', 'esc']);
  });

  it('asks to confirm a delete with no as the default', () => {
    const asking: LibraryScreen = {
      ...screen([validEntry('a', 'Alpha')]),
      mode: { kind: 'confirm-delete' },
    };
    const view = renderLibraryScreen(asking, plainContext());
    expect(view.body.join('\n')).toContain('Delete "Alpha"? [y/N]');
    expect(view.hints.map((hint) => hint.key)).toEqual(['y', 'n']);
  });

  it('shows an inline error such as a name collision', () => {
    const failed: LibraryScreen = {
      ...screen([validEntry('a')]),
      error: 'A recording named "Beta" already exists',
    };
    expect(
      renderLibraryScreen(failed, plainContext()).body.join('\n'),
    ).toContain('✖ A recording named "Beta" already exists');
  });

  describe('a long error', () => {
    const longMessage =
      'macOS blocked reading the Brave profile. Give your terminal app Full Disk Access in System Settings › Privacy & Security, then restart the terminal and try again.';
    const failed = (count: number): LibraryScreen => ({
      ...screen(
        Array.from({ length: count }, (_, index) =>
          validEntry(`s${String(index)}`, `Rec ${String(index)}`),
        ),
      ),
      error: longMessage,
    });

    it('wraps between the status line and the rows without clipping it', () => {
      const body = renderLibraryScreen(failed(2), plainContext()).body;
      const statusAt = body.findIndex((line) => line.includes('1/2'));
      const firstRowAt = body.findIndex((line) => line.includes('Rec 0'));
      const errorLines = body.slice(statusAt + 1, firstRowAt);
      expect(errorLines.length).toBeGreaterThan(1);
      expect(errorLines[0]).toContain('✖ macOS blocked');
      expect(errorLines.join(' ').replace(/\s+/g, ' ')).toContain(
        'restart the terminal and try again.',
      );
      expect(body.join('\n')).not.toContain('…');
      expect(body.every((line) => cellWidth(line) <= 76)).toBe(true);
    });

    it('leaves fewer rows for the list so the body keeps its height', () => {
      const context = plainContext();
      const short = renderLibraryScreen(
        { ...failed(30), error: 'short' },
        context,
      ).body;
      const long = renderLibraryScreen(failed(30), context).body;
      expect(long.length).toBeLessThanOrEqual(context.height);
      expect(long.length).toBe(short.length);
    });
  });

  describe('change browser mode', () => {
    const changing = (
      overrides: Partial<ChangeBrowserMode> = {},
      error: string | null = null,
    ): LibraryScreen => ({
      ...screen([validEntry('a', 'Alpha', { browser: BRAVE_CHOICE })]),
      error,
      mode: {
        kind: 'change-browser',
        slug: 'a',
        current: BRAVE_CHOICE,
        focus: 'browser',
        browsers: BROWSER_VIEWS,
        browserIndex: 0,
        profileIndex: 0,
        ...overrides,
      },
    });
    const textOf = (view: ScreenView): string => view.body.join('\n');

    it('asks which browser the recording should use and shows both pickers', () => {
      const text = textOf(renderLibraryScreen(changing(), plainContext()));
      expect(text).toContain('Browser for "Alpha"');
      expect(text).toContain('◂ Brave ▸ 1/2');
      expect(text).toContain('Profile');
      expect(text).toContain('Managed (keeps logins) 1/3');
      expect(text).toContain('Alpha');
    });

    it('shows the current copy-of-real profile with its note', () => {
      const view = renderLibraryScreen(
        changing({ focus: 'profile', profileIndex: 1 }),
        plainContext(),
      );
      const text = textOf(view);
      expect(text).toContain('◂ Copy of Person 1 (Default) ▸ 2/3');
      expect(text).toContain('! Brave is running: the copy may miss');
    });

    it('says the browsers are being detected, or that none was found', () => {
      const detecting = changing({ browsers: null });
      const none = changing({ browsers: [] });
      expect(textOf(renderLibraryScreen(detecting, plainContext()))).toContain(
        'Detecting browsers…',
      );
      expect(textOf(renderLibraryScreen(none, plainContext()))).toContain(
        'No browser detected',
      );
    });

    it('lists the keys of the mode', () => {
      const hints = renderLibraryScreen(changing(), plainContext()).hints;
      expect(hints).toEqual([
        { key: 'tab', label: 'next field' },
        { key: '←→', label: 'change' },
        { key: 'enter', label: 'save' },
        { key: 'esc', label: 'cancel' },
      ]);
    });

    it('keeps the body inside the screen with a long error and many rows', () => {
      const entries = Array.from({ length: 30 }, (_, index) =>
        validEntry(`s${String(index)}`, `Rec ${String(index)}`),
      );
      const crowded: LibraryScreen = {
        ...changing(
          {},
          'macOS blocked reading the Brave profile. Give your terminal app Full Disk Access in System Settings, then restart the terminal and try again.',
        ),
        entries,
      };
      const context = plainContext();
      const body = renderLibraryScreen(crowded, context).body;
      expect(body.length).toBeLessThanOrEqual(context.height);
      expect(body.join(' ').replace(/\s+/g, ' ')).toContain('Full Disk Access');
      expect(body.every((line) => cellWidth(line) <= context.width)).toBe(true);
    });
  });

  it('lists the browse keys', () => {
    const keys = renderLibraryScreen(
      screen([validEntry('a')]),
      plainContext(),
    ).hints.map((hint) => hint.key);
    expect(keys).toEqual(['↑↓', 'enter', 'h', 't', 'r', 'b', 'd', 'n', 'esc']);
  });
});
