import { describe, expect, it } from 'vitest';

import { runTui } from '../../../src/tui/application/tui-session.ts';
import { createFrameRenderer } from '../../../src/tui/render/render-frame.ts';
import { createFakeClock, createFakeTimers } from '../../support/fake-clock.ts';
import { createFakeServices } from '../../support/fake-app-services.ts';
import { createFakeTerminal } from '../../support/fake-terminal.ts';
import { clickAt, validEntry } from '../../support/tui-fixtures.ts';

// Any SGR sequence: the colors, bold and reverse video.
const SGR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`);
const HOME = '\u001b[H';

function start(
  options: { hasColor?: boolean; columns?: number; rows?: number } = {},
) {
  const fake = createFakeServices();
  const clock = createFakeClock(0);
  const timers = createFakeTimers(clock);
  const terminal = createFakeTerminal({
    columns: options.columns ?? 80,
    rows: options.rows ?? 24,
  });
  const session = runTui({
    services: fake.services,
    terminal,
    timers,
    renderFrame: createFrameRenderer(options.hasColor ?? false),
  });
  async function settle(): Promise<void> {
    for (let turn = 0; turn < 6; turn += 1) {
      await Promise.resolve();
      timers.flushDeferred();
    }
  }
  function lastFrame(): string {
    const frames = terminal.writes.filter((text) => text.startsWith(HOME));
    return frames.at(-1) ?? '';
  }
  return { fake, clock, terminal, session, settle, lastFrame };
}

describe('src/tui (session over a fake terminal)', () => {
  it('takes over the terminal and draws the main menu', async () => {
    const app = start();
    await app.settle();
    expect(app.terminal.isEntered()).toBe(true);
    expect(app.lastFrame()).toContain('New recording');
    expect(app.lastFrame().startsWith(HOME)).toBe(true);
  });

  it('restores the terminal when the user quits', async () => {
    const app = start();
    await app.settle();
    app.terminal.press('down');
    app.terminal.press('down');
    app.terminal.press('return');
    await app.session;
    expect(app.terminal.isEntered()).toBe(false);
    expect(app.terminal.restoreCount).toBe(1);
  });

  it('restores the terminal on Ctrl+C', async () => {
    const app = start();
    await app.settle();
    app.terminal.press('c', { ctrl: true });
    await app.session;
    expect(app.terminal.isEntered()).toBe(false);
  });

  it('creates a recording and shows streamed events within one refresh interval', async () => {
    const app = start();
    await app.settle();
    app.terminal.press('return');
    // Browser detection finishes before the user has typed a name.
    await app.settle();
    app.terminal.type('Demo');
    app.terminal.press('return');
    await app.settle();
    expect(app.lastFrame()).toContain('REC');
    app.fake.live.emit({
      events: [clickAt(1250, 'Button "Save"')],
      pendingDialog: null,
      isClosed: false,
    });
    app.clock.advance(250);
    await app.settle();
    expect(app.lastFrame()).toContain('+00:01.250');
    expect(app.lastFrame()).toContain('Button "Save"');
  });

  it('shows an inline error and does not start for an invalid URL', async () => {
    const app = start();
    await app.settle();
    app.terminal.press('return');
    // Browser detection finishes before the user has typed a name.
    await app.settle();
    app.terminal.type('Demo');
    app.terminal.press('tab');
    app.terminal.type('ftp://x');
    app.terminal.press('return');
    await app.settle();
    expect(app.lastFrame()).toContain(
      'Start URL must be empty or an http/https URL.',
    );
    expect(app.fake.startRequests).toEqual([]);
  });

  it('highlights the replaying step and shows its drift', async () => {
    const app = start();
    app.fake.entries = [validEntry('alpha', 'Alpha')];
    await app.settle();
    app.terminal.press('down');
    app.terminal.press('return');
    await app.settle();
    app.terminal.press('return');
    await app.settle();
    app.fake.replay.emit({
      status: 'running',
      errorMessage: null,
      steps: [
        { index: 0, status: 'done', driftMs: 4 },
        { index: 1, status: 'done', driftMs: -2 },
        { index: 2, status: 'running', driftMs: null },
      ],
    });
    await app.settle();
    const frame = app.lastFrame();
    expect(frame).toContain('✓ +00:00.000');
    expect(frame).toContain('▶ +00:02.000');
    expect(frame).toContain('+4ms');
    expect(frame).toContain('-2ms');
  });

  it('refits the layout when the terminal is resized', async () => {
    const app = start();
    await app.settle();
    app.terminal.resize({ columns: 100, rows: 30 });
    await app.settle();
    const lines = app.lastFrame().split('\r\n');
    expect(lines).toHaveLength(30);
  });

  it('draws with color by default and without any SGR code under NO_COLOR', async () => {
    const colored = start({ hasColor: true });
    await colored.settle();
    expect(SGR.test(colored.lastFrame())).toBe(true);
    const plain = start({ hasColor: false });
    await plain.settle();
    expect(SGR.test(plain.lastFrame())).toBe(false);
  });

  it('keeps the library list fresh by itself', async () => {
    const app = start();
    app.fake.entries = [validEntry('alpha', 'Alpha')];
    await app.settle();
    app.terminal.press('down');
    app.terminal.press('return');
    await app.settle();
    expect(app.lastFrame()).toContain('Alpha');
    app.fake.entries = [
      validEntry('alpha', 'Alpha'),
      validEntry('beta', 'Beta'),
    ];
    app.clock.advance(2000);
    await app.settle();
    expect(app.lastFrame()).toContain('Beta');
  });
});
