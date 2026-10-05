import { describe, expect, it, vi } from 'vitest';
import { createFakeTerminal } from '../../support/fake-terminal.ts';

describe('tests/support/fake-terminal.ts', () => {
  it('reports the size it was built with and follows resizes', () => {
    const terminal = createFakeTerminal({ columns: 80, rows: 24 });
    const onResize = vi.fn();
    terminal.onResize(onResize);

    expect(terminal.size()).toEqual({ columns: 80, rows: 24 });
    terminal.resize({ columns: 100, rows: 30 });
    expect(terminal.size()).toEqual({ columns: 100, rows: 30 });
    expect(onResize).toHaveBeenCalledTimes(1);
  });

  it('collects everything written, in order', () => {
    const terminal = createFakeTerminal();
    terminal.write('one');
    terminal.write('two');
    expect(terminal.writes).toEqual(['one', 'two']);
    expect(terminal.output()).toBe('onetwo');
  });

  it('delivers key presses with the shape of a readline keypress', () => {
    const terminal = createFakeTerminal();
    const keys: string[] = [];
    terminal.onKey((key) =>
      keys.push(`${key.name ?? key.sequence}:${String(key.ctrl)}`),
    );

    terminal.press('down');
    terminal.press('c', { ctrl: true });
    terminal.type('q');
    expect(keys).toEqual(['down:false', 'c:true', 'q:false']);
  });

  it('tracks enter and restore, and tolerates a second restore', () => {
    const terminal = createFakeTerminal();
    expect(terminal.isEntered()).toBe(false);

    terminal.enter();
    expect(terminal.isEntered()).toBe(true);
    terminal.restore();
    terminal.restore();
    expect(terminal.isEntered()).toBe(false);
    expect(terminal.restoreCount).toBe(2);
  });
});
