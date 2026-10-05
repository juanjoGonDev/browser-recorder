import { describe, expect, it } from 'vitest';

import {
  RECORDED_TIMING,
  humanTiming,
} from '../../../src/shared/domain/replay-timing.ts';
import type {
  ReplayScreen,
  TimelineScreen,
} from '../../../src/tui/domain/app-state.ts';
import type { ReplayView } from '../../../src/tui/domain/app-views.ts';
import { renderReplayScreen } from '../../../src/tui/render/screens/replay-screen.ts';
import { renderTimelineScreen } from '../../../src/tui/render/screens/timeline-screen.ts';
import { createStyle } from '../../../src/tui/render/ansi.ts';
import { plainContext } from '../../support/render-context.ts';
import { clicks, recordingWith } from '../../support/tui-fixtures.ts';
import { BRAVE_CHOICE } from '../../support/browser-fixtures.ts';

function timeline(count: number, selected = 0): TimelineScreen {
  return {
    kind: 'timeline',
    recording: recordingWith(clicks(count)),
    cursor: { selected, top: 0 },
  };
}

function replay(view: ReplayView, count = 5): ReplayScreen {
  return {
    kind: 'replay',
    browser: BRAVE_CHOICE,
    warnings: [],
    name: 'Checkout flow',
    events: clicks(count),
    view,
    timing: RECORDED_TIMING,
    startedAtMs: 0,
  };
}

const running: ReplayView = {
  status: 'running',
  errorMessage: null,
  steps: [
    { index: 0, status: 'done', driftMs: 4 },
    { index: 1, status: 'done', driftMs: -3 },
    { index: 2, status: 'running', driftMs: null },
    { index: 3, status: 'pending', driftMs: null },
    { index: 4, status: 'pending', driftMs: null },
  ],
};

describe('src/tui/render/screens/replay-screen.ts (browser)', () => {
  it('names the browser and profile the replay runs on', () => {
    const text = renderReplayScreen(replay(running), plainContext()).body.join(
      '\n',
    );
    expect(text).toContain('Brave · managed');
  });

  it('shows the fallback warning with the missing browser name', () => {
    const text = renderReplayScreen(
      {
        ...replay(running),
        browser: { ...BRAVE_CHOICE, browserId: 'bundled' },
        warnings: ['Brave is not installed: replaying on bundled Chromium'],
      },
      plainContext(),
    ).body.join('\n');
    expect(text).toContain(
      '! Brave is not installed: replaying on bundled Chromium',
    );
    expect(text).toContain('Chromium (bundled) · managed');
  });

  it('keeps the running step visible below the warnings', () => {
    const text = renderReplayScreen(
      { ...replay(running, 40), warnings: ['one', 'two'] },
      plainContext({ height: 8 }),
    ).body.join('\n');
    expect(text).toContain('! two');
    expect(text).toContain('Step 2');
  });
});

describe('src/tui/render/screens/timeline-screen.ts', () => {
  it('shows the recorded browser and profile', () => {
    const view = renderTimelineScreen(timeline(3), plainContext());
    expect(view.body.join('\n')).toContain('Chromium (bundled) · ephemeral');
  });

  it('summarises the recording and lists events with offsets', () => {
    const view = renderTimelineScreen(timeline(3), plainContext());
    const text = view.body.join('\n');
    expect(view.title).toBe('Timeline · Checkout flow');
    expect(text).toContain('3 events');
    expect(text).toContain('1:00');
    expect(text).toContain('+00:02.000');
    expect(text).toContain('Step 2');
  });

  it('marks the selected event and keeps it visible when scrolling', () => {
    const view = renderTimelineScreen(
      timeline(40, 30),
      plainContext({ height: 8 }),
    );
    const lines = view.body;
    expect(
      lines.find((line) => line.includes('Step 30'))?.startsWith('❯'),
    ).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(8);
  });

  it('shows a message for a recording without events', () => {
    expect(
      renderTimelineScreen(timeline(0), plainContext()).body.join('\n'),
    ).toContain('No events were recorded.');
  });

  it('lists the scroll keys', () => {
    expect(
      renderTimelineScreen(timeline(2), plainContext()).hints.map(
        (hint) => hint.key,
      ),
    ).toEqual(['↑↓', 'pgup/pgdn', 'esc']);
  });
});

describe('src/tui/render/screens/replay-screen.ts', () => {
  it('highlights the running step and marks earlier steps done', () => {
    const lines = renderReplayScreen(replay(running), plainContext()).body;
    expect(lines.find((line) => line.includes('Step 0'))?.startsWith('✓')).toBe(
      true,
    );
    expect(lines.find((line) => line.includes('Step 1'))?.startsWith('✓')).toBe(
      true,
    );
    expect(lines.find((line) => line.includes('Step 2'))?.startsWith('▶')).toBe(
      true,
    );
    expect(lines.find((line) => line.includes('Step 3'))?.startsWith('·')).toBe(
      true,
    );
  });

  it('highlights the running step with reverse video when color is on', () => {
    const lines = renderReplayScreen(
      replay(running),
      plainContext({ style: createStyle(true) }),
    ).body;
    expect(
      lines.find((line) => line.includes('Step 2'))?.startsWith('\u001b[7m'),
    ).toBe(true);
    expect(
      lines.find((line) => line.includes('Step 1'))?.startsWith('\u001b[7m'),
    ).toBe(false);
  });

  it('shows the drift of every finished step', () => {
    const text = renderReplayScreen(replay(running), plainContext()).body.join(
      '\n',
    );
    expect(text).toContain('+4ms');
    expect(text).toContain('-3ms');
  });

  it('shows the status and progress while running', () => {
    const text = renderReplayScreen(
      replay(running),
      plainContext({ nowMs: 2500 }),
    ).body.join('\n');
    expect(text).toContain('Running');
    expect(text).toContain('step 3/5');
    expect(text).toContain('00:02.500');
  });

  it('reports a failure with its message and offers to go back', () => {
    const failed: ReplayView = {
      ...running,
      status: 'failed',
      errorMessage: 'locator not found',
    };
    const view = renderReplayScreen(replay(failed), plainContext());
    expect(view.body.join('\n')).toContain('Failed');
    expect(view.body.join('\n')).toContain('locator not found');
    expect(view.hints.map((hint) => hint.key)).toEqual(['esc']);
  });

  it('shows succeeded and cancelled runs', () => {
    const done: ReplayView = {
      status: 'succeeded',
      errorMessage: null,
      steps: running.steps.map((step) => ({
        ...step,
        status: 'done',
        driftMs: 1,
      })),
    };
    expect(
      renderReplayScreen(replay(done), plainContext()).body.join('\n'),
    ).toContain('Finished');
    const cancelled: ReplayView = { ...running, status: 'cancelled' };
    expect(
      renderReplayScreen(replay(cancelled), plainContext()).body.join('\n'),
    ).toContain('Cancelled');
  });

  it('offers to cancel while running', () => {
    expect(
      renderReplayScreen(replay(running), plainContext()).hints.map(
        (hint) => hint.key,
      ),
    ).toEqual(['c']);
  });

  it('follows the running step in a long list', () => {
    const steps = Array.from(
      { length: 60 },
      (_, index) =>
        ({
          index,
          status: index < 40 ? 'done' : index === 40 ? 'running' : 'pending',
          driftMs: index < 40 ? 2 : null,
        }) as const,
    );
    const long: ReplayScreen = {
      ...replay({ status: 'running', errorMessage: null, steps }, 60),
    };
    const view = renderReplayScreen(long, plainContext({ height: 10 }));
    expect(view.body.join('\n')).toContain('Step 40');
    expect(view.body.length).toBeLessThanOrEqual(10);
  });

  it('colors a drift above the tolerance as a warning', () => {
    const slow: ReplayView = {
      ...running,
      steps: [
        { index: 0, status: 'done', driftMs: 250 },
        ...running.steps.slice(1),
      ],
    };
    const text = renderReplayScreen(
      replay(slow),
      plainContext({ style: createStyle(true) }),
    ).body.join('\n');
    expect(text).toContain('\u001b[33m+250ms');
  });
});

describe('src/tui/render/screens/replay-screen.ts (timing)', () => {
  it('shows the recorded mode label', () => {
    const text = renderReplayScreen(replay(running), plainContext()).body.join(
      '\n',
    );
    expect(text).toContain('recorded timing');
  });

  it('shows the human mode label with its range', () => {
    const screen = { ...replay(running), timing: humanTiming() };
    const text = renderReplayScreen(screen, plainContext()).body.join('\n');
    expect(text).toContain('human timing 250-900 ms');
    expect(text).not.toContain('recorded timing');
  });

  it('shows no drift column in human mode even if a view carries drift', () => {
    const recorded = renderReplayScreen(replay(running), plainContext());
    const human = renderReplayScreen(
      { ...replay(running), timing: humanTiming() },
      plainContext(),
    );
    expect(recorded.body.join('\n')).toContain('+4ms');
    expect(human.body.join('\n')).not.toMatch(/[+-]\d+ms/u);
  });
});
