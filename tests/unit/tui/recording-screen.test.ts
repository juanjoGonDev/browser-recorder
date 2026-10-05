import { describe, expect, it } from 'vitest';

import type { RecordingScreen } from '../../../src/tui/domain/app-state.ts';
import { emptyField } from '../../../src/tui/domain/text-input.ts';
import { renderRecordingScreen } from '../../../src/tui/render/screens/recording-screen.ts';
import { plainContext } from '../../support/render-context.ts';
import { clickAt, clicks, passwordFill } from '../../support/tui-fixtures.ts';

const idle: RecordingScreen = {
  kind: 'recording',
  name: 'Demo',
  startedAtMs: 1000,
  events: [],
  pendingDialog: null,
  promptText: emptyField(),
  isConfirmingDiscard: false,
  isStopping: false,
};

function text(screen: RecordingScreen, nowMs = 1000, height = 21): string {
  return renderRecordingScreen(
    screen,
    plainContext({ nowMs, height }),
  ).body.join('\n');
}

describe('src/tui/render/screens/recording-screen.ts', () => {
  it('shows the elapsed time and a waiting message before the first event', () => {
    const view = text(idle, 13_345);
    expect(view).toContain('REC');
    expect(view).toContain('Demo');
    expect(view).toContain('00:12.345');
    expect(view).toContain('0 events');
    expect(view).toContain('Waiting for your first action');
  });

  it('streams events with their offsets and counts them', () => {
    const view = text({
      ...idle,
      events: [clickAt(250, 'Button "Go"'), clickAt(1500, 'Link "Docs"')],
    });
    expect(view).toContain('2 events');
    expect(view).toContain('+00:00.250');
    expect(view).toContain('Button "Go"');
    expect(view).toContain('+00:01.500');
    expect(view).toContain('Link "Docs"');
  });

  it('uses the singular for one event', () => {
    expect(text({ ...idle, events: [clickAt(0)] })).toContain('1 event');
    expect(text({ ...idle, events: [clickAt(0)] })).not.toContain('1 events');
  });

  it('draws a gap bar for a long pause between events', () => {
    const view = text({ ...idle, events: [clickAt(0), clickAt(4000)] });
    expect(view).toContain('━━━━━');
  });

  it('follows the newest events when the list is longer than the screen', () => {
    const view = text({ ...idle, events: clicks(40) }, 1000, 12);
    expect(view).toContain('Step 39');
    expect(view).not.toContain('Step 0 ');
    expect(view).not.toContain('Step 1 ');
  });

  it('masks sensitive values and says so', () => {
    const view = text({ ...idle, events: [passwordFill(100, 'hunter2')] });
    expect(view).toContain('Password = ••••••••');
    expect(view).not.toContain('hunter2');
    expect(view).toContain('1 sensitive value masked');
  });

  it('shows a dialog banner with its keys', () => {
    const screen: RecordingScreen = {
      ...idle,
      pendingDialog: {
        dialogType: 'confirm',
        message: 'Delete it?',
        defaultValue: '',
      },
    };
    const view = renderRecordingScreen(screen, plainContext());
    expect(view.body.join('\n')).toContain('confirm dialog: "Delete it?"');
    expect(view.hints.map((hint) => hint.key)).toEqual(['a', 'd']);
  });

  it('shows the typed answer of a prompt dialog', () => {
    const screen: RecordingScreen = {
      ...idle,
      promptText: emptyField('Bob'),
      pendingDialog: {
        dialogType: 'prompt',
        message: 'Name?',
        defaultValue: '',
      },
    };
    const view = renderRecordingScreen(screen, plainContext());
    expect(view.body.join('\n')).toContain('Answer: Bob▏');
    expect(view.hints.map((hint) => hint.key)).toEqual(['enter', 'esc']);
  });

  it('asks before discarding, with no as the default', () => {
    const view = renderRecordingScreen(
      { ...idle, isConfirmingDiscard: true },
      plainContext(),
    );
    expect(view.body.join('\n')).toContain('Discard this recording? [y/N]');
    expect(view.hints.map((hint) => hint.key)).toEqual(['y', 'n']);
  });

  it('shows saving while stopping and offers no keys', () => {
    const view = renderRecordingScreen(
      { ...idle, isStopping: true },
      plainContext(),
    );
    expect(view.body.join('\n')).toContain('Saving');
    expect(view.hints).toEqual([]);
  });

  it('keeps the body inside the available rows with a banner open', () => {
    const screen: RecordingScreen = {
      ...idle,
      events: clicks(40),
      pendingDialog: { dialogType: 'alert', message: 'Hi', defaultValue: '' },
    };
    const view = renderRecordingScreen(screen, plainContext({ height: 12 }));
    expect(view.body.length).toBeLessThanOrEqual(12);
    expect(view.body.join('\n')).toContain('Step 39');
  });
});
