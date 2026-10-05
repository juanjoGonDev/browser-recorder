import { describe, expect, it } from 'vitest';

import type { RecordingEvent } from '../../../src/shared/domain/recording-event.ts';
import { createStyle } from '../../../src/tui/render/ansi.ts';
import { cellWidth, stripAnsi } from '../../../src/tui/render/layout.ts';
import {
  NO_DECORATION,
  timelineRow,
} from '../../../src/tui/render/timeline-list.ts';

const target = {
  locator: { kind: 'css', selector: '#go' },
  nth: null,
  framePath: [],
  description: 'Button "Go"',
} as const;

function click(offsetMs: number): RecordingEvent {
  return {
    kind: 'click',
    offsetMs,
    pageId: 'page1',
    target,
    button: 'left',
    modifiers: [],
  };
}

const events: RecordingEvent[] = [
  { kind: 'goto', offsetMs: 0, pageId: 'page1', url: 'https://example.com' },
  click(1250),
  click(1300),
];
const plain = createStyle(false);
const color = createStyle(true);

describe('src/tui/render/timeline-list.ts', () => {
  it('shows the offset, a gap bar, the label and the detail', () => {
    const row = timelineRow(events, 1, {
      width: 76,
      style: plain,
      decoration: NO_DECORATION,
    });
    expect(row).toBe(
      '  +00:01.250 ━━━    click         Button "Go"'.padEnd(76, ' '),
    );
  });

  it('draws no gap bar for the first event or a short pause', () => {
    const first = timelineRow(events, 0, {
      width: 76,
      style: plain,
      decoration: NO_DECORATION,
    });
    expect(first.startsWith('  +00:00.000        goto')).toBe(true);
    const quick = timelineRow(events, 2, {
      width: 76,
      style: plain,
      decoration: NO_DECORATION,
    });
    expect(quick.startsWith('  +00:01.300        click')).toBe(true);
  });

  it('puts the marker first and the suffix at the right edge', () => {
    const row = timelineRow(events, 1, {
      width: 60,
      style: plain,
      decoration: {
        symbol: '✓',
        tone: 'done',
        isHighlighted: false,
        suffix: '+12ms',
      },
    });
    expect(row.startsWith('✓ +00:01.250')).toBe(true);
    expect(row.endsWith('+12ms')).toBe(true);
    expect(cellWidth(row)).toBe(60);
  });

  it('clips the detail to the width instead of overflowing', () => {
    const row = timelineRow(events, 0, {
      width: 40,
      style: plain,
      decoration: NO_DECORATION,
    });
    expect(cellWidth(row)).toBe(40);
    expect(row.endsWith('…')).toBe(true);
  });

  it('highlights the current row with reverse video only when color is on', () => {
    const decoration = {
      symbol: '▶',
      tone: 'running',
      isHighlighted: true,
      suffix: '',
    } as const;
    const lit = timelineRow(events, 1, { width: 60, style: color, decoration });
    expect(lit.startsWith('\u001b[7m')).toBe(true);
    expect(stripAnsi(lit).startsWith('▶ +00:01.250')).toBe(true);
    const unlit = timelineRow(events, 1, {
      width: 60,
      style: plain,
      decoration,
    });
    expect(unlit).not.toContain('\u001b');
    expect(unlit.startsWith('▶ ')).toBe(true);
  });

  it('keeps the width exact with color on', () => {
    const row = timelineRow(events, 1, {
      width: 60,
      style: color,
      decoration: {
        symbol: '✓',
        tone: 'done',
        isHighlighted: false,
        suffix: '-3ms',
      },
    });
    expect(cellWidth(row)).toBe(60);
  });
});
