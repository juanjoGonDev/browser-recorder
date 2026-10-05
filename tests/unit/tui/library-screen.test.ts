import { describe, expect, it } from 'vitest';

import type { LibraryScreen } from '../../../src/tui/domain/app-state.ts';
import type { LibraryEntryView } from '../../../src/tui/domain/app-views.ts';
import { emptyField } from '../../../src/tui/domain/text-input.ts';
import { createStyle } from '../../../src/tui/render/ansi.ts';
import { cellWidth } from '../../../src/tui/render/layout.ts';
import { renderLibraryScreen } from '../../../src/tui/render/screens/library-screen.ts';
import { plainContext } from '../../support/render-context.ts';
import { validEntry } from '../../support/tui-fixtures.ts';

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
  };
}

describe('src/tui/render/screens/library-screen.ts', () => {
  it('shows an empty state with the new hint', () => {
    const view = renderLibraryScreen(screen([]), plainContext());
    const text = view.body.join('\n');
    expect(text).toContain('No recordings yet.');
    expect(text).toContain('Press n to create your first recording.');
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

  it('lists the browse keys', () => {
    const keys = renderLibraryScreen(
      screen([validEntry('a')]),
      plainContext(),
    ).hints.map((hint) => hint.key);
    expect(keys).toEqual(['↑↓', 'enter', 't', 'r', 'd', 'n', 'esc']);
  });
});
