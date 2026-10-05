import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import {
  createNodeTerminal,
  interactiveTerminalProblem,
  type NodeTerminalDeps,
} from '../../../src/tui/adapters/node-terminal.ts';
import type { KeyPress } from '../../../src/tui/application/ports/terminal.ts';

class FakeInput extends EventEmitter {
  isTTY: boolean | undefined = true;
  rawModes: boolean[] = [];
  resumeCount = 0;
  pauseCount = 0;
  setRawMode(isEnabled: boolean): this {
    this.rawModes.push(isEnabled);
    return this;
  }
  resume(): this {
    this.resumeCount += 1;
    return this;
  }
  pause(): this {
    this.pauseCount += 1;
    return this;
  }
}

class FakeOutput extends EventEmitter {
  isTTY: boolean | undefined = true;
  columns: number | undefined = 100;
  rows: number | undefined = 30;
  readonly written: string[] = [];
  write(text: string): boolean {
    this.written.push(text);
    return true;
  }
}

class FakeProcess extends EventEmitter {
  readonly errors: string[] = [];
  readonly exitCodes: number[] = [];
  readonly stderr = {
    write: (text: string): boolean => {
      this.errors.push(text);
      return true;
    },
  };
  exit(code: number): void {
    this.exitCodes.push(code);
  }
}

function setup() {
  const input = new FakeInput();
  const output = new FakeOutput();
  const proc = new FakeProcess();
  const deps: NodeTerminalDeps = {
    input,
    output,
    process: proc,
  };
  const terminal = createNodeTerminal(deps);
  const keys: KeyPress[] = [];
  terminal.onKey((key) => keys.push(key));
  return {
    input,
    output,
    proc,
    terminal,
    keys,
  };
}

const ALT_SCREEN_ON = '\u001b[?1049h';
const ALT_SCREEN_OFF = '\u001b[?1049l';
const HIDE_CURSOR = '\u001b[?25l';
const SHOW_CURSOR = '\u001b[?25h';

describe('src/tui/adapters/node-terminal.ts', () => {
  describe('lifecycle', () => {
    it('enters the alternate screen with a hidden cursor and raw mode', () => {
      const { terminal, input, output } = setup();
      terminal.enter();
      const written = output.written.join('');
      expect(written).toContain(ALT_SCREEN_ON);
      expect(written).toContain(HIDE_CURSOR);
      expect(input.rawModes).toEqual([true]);
      expect(input.resumeCount).toBe(1);
    });

    it('restores raw mode, the cursor and the primary screen', () => {
      const { terminal, input, output } = setup();
      terminal.enter();
      output.written.length = 0;
      terminal.restore();
      const written = output.written.join('');
      expect(written).toContain(SHOW_CURSOR);
      expect(written).toContain(ALT_SCREEN_OFF);
      expect(input.rawModes).toEqual([true, false]);
      expect(input.pauseCount).toBe(1);
    });

    it('is safe to restore twice and to restore without entering', () => {
      const { terminal, input, output } = setup();
      terminal.restore();
      expect(output.written).toEqual([]);
      terminal.enter();
      terminal.restore();
      terminal.restore();
      expect(input.rawModes).toEqual([true, false]);
      expect(
        output.written.filter((text) => text.includes(ALT_SCREEN_OFF)),
      ).toHaveLength(1);
    });

    it('does not enter twice', () => {
      const { terminal, input } = setup();
      terminal.enter();
      terminal.enter();
      expect(input.rawModes).toEqual([true]);
    });
  });

  describe('crash and signal safety', () => {
    it('restores the terminal and reports an uncaught error before exiting', () => {
      const { terminal, proc, output, input } = setup();
      terminal.enter();
      output.written.length = 0;
      proc.emit('uncaughtException', new Error('boom'));
      expect(output.written.join('')).toContain(ALT_SCREEN_OFF);
      expect(input.rawModes).toEqual([true, false]);
      expect(proc.errors.join('')).toContain('boom');
      expect(proc.exitCodes).toEqual([1]);
    });

    it('also handles unhandled rejections, even of non-errors', () => {
      const { terminal, proc, output } = setup();
      terminal.enter();
      output.written.length = 0;
      proc.emit('unhandledRejection', 'plain reason');
      expect(output.written.join('')).toContain(ALT_SCREEN_OFF);
      expect(proc.errors.join('')).toContain('plain reason');
      expect(proc.exitCodes).toEqual([1]);
    });

    it('restores on SIGINT and SIGTERM with the conventional exit codes', () => {
      const first = setup();
      first.terminal.enter();
      first.proc.emit('SIGINT');
      expect(first.proc.exitCodes).toEqual([130]);
      expect(first.output.written.join('')).toContain(ALT_SCREEN_OFF);
      const second = setup();
      second.terminal.enter();
      second.proc.emit('SIGTERM');
      expect(second.proc.exitCodes).toEqual([143]);
    });

    it('restores when the process exits for any other reason', () => {
      const { terminal, proc, output } = setup();
      terminal.enter();
      output.written.length = 0;
      proc.emit('exit');
      expect(output.written.join('')).toContain(ALT_SCREEN_OFF);
      expect(proc.exitCodes).toEqual([]);
    });

    it('stops listening to the process once restored', () => {
      const { terminal, proc } = setup();
      terminal.enter();
      expect(proc.listenerCount('uncaughtException')).toBe(1);
      terminal.restore();
      for (const event of [
        'uncaughtException',
        'unhandledRejection',
        'SIGINT',
        'SIGTERM',
        'exit',
      ]) {
        expect(proc.listenerCount(event)).toBe(0);
      }
    });
  });

  describe('size, output and resize', () => {
    it('reports the output size, with a classic default when unknown', () => {
      const { terminal, output } = setup();
      expect(terminal.size()).toEqual({ columns: 100, rows: 30 });
      output.columns = undefined;
      output.rows = undefined;
      expect(terminal.size()).toEqual({ columns: 80, rows: 24 });
    });

    it('writes to the output and forwards resizes', () => {
      const { terminal, output } = setup();
      let resizes = 0;
      terminal.onResize(() => {
        resizes += 1;
      });
      terminal.write('hello');
      output.emit('resize');
      expect(output.written).toContain('hello');
      expect(resizes).toBe(1);
    });
  });

  describe('keys', () => {
    it('turns readline keypress events into key presses', () => {
      const { input, keys } = setup();
      input.emit('keypress', undefined, {
        name: 'down',
        sequence: '\u001b[B',
        ctrl: false,
        meta: false,
        shift: false,
      });
      input.emit('keypress', 'c', {
        name: 'c',
        sequence: '\u0003',
        ctrl: true,
        meta: false,
        shift: false,
      });
      expect(keys).toEqual([
        {
          name: 'down',
          sequence: '\u001b[B',
          ctrl: false,
          meta: false,
          shift: false,
        },
        {
          name: 'c',
          sequence: '\u0003',
          ctrl: true,
          meta: false,
          shift: false,
        },
      ]);
    });

    it('reports printable characters without a name, whatever readline calls them', () => {
      const { input, keys } = setup();
      input.emit('keypress', 'a', {
        name: 'a',
        sequence: 'a',
        ctrl: false,
        meta: false,
        shift: false,
      });
      input.emit('keypress', 'A', {
        name: 'a',
        sequence: 'A',
        ctrl: false,
        meta: false,
        shift: true,
      });
      input.emit('keypress', ' ', {
        name: 'space',
        sequence: ' ',
        ctrl: false,
        meta: false,
        shift: false,
      });
      input.emit('keypress', '7', {
        sequence: '7',
        ctrl: false,
        meta: false,
        shift: false,
      });
      input.emit('keypress', 'é', undefined);
      expect(keys.map((key) => [key.name, key.sequence])).toEqual([
        [null, 'a'],
        [null, 'A'],
        [null, ' '],
        [null, '7'],
        [null, 'é'],
      ]);
    });

    it('keeps modified letters named so shortcuts stay shortcuts', () => {
      const { input, keys } = setup();
      input.emit('keypress', undefined, {
        name: 'u',
        sequence: '\u0015',
        ctrl: true,
        meta: false,
        shift: false,
      });
      expect(keys[0]).toMatchObject({ name: 'u', ctrl: true });
    });

    it('treats the line feed key as Enter', () => {
      const { input, keys } = setup();
      input.emit('keypress', '\n', {
        name: 'enter',
        sequence: '\n',
        ctrl: false,
        meta: false,
        shift: false,
      });
      input.emit('keypress', '\r', {
        name: 'return',
        sequence: '\r',
        ctrl: false,
        meta: false,
        shift: false,
      });
      expect(keys.map((key) => key.name)).toEqual(['return', 'return']);
    });

    it('ignores keypress events with neither text nor a key', () => {
      const { input, keys } = setup();
      input.emit('keypress', undefined, undefined);
      expect(keys).toEqual([]);
    });
  });

  describe('interactiveTerminalProblem', () => {
    it('accepts a real terminal', () => {
      expect(
        interactiveTerminalProblem({
          input: new FakeInput(),
          output: new FakeOutput(),
        }),
      ).toBeNull();
    });

    it('asks for an interactive terminal when stdin is not a TTY', () => {
      const input = new FakeInput();
      input.isTTY = undefined;
      expect(
        interactiveTerminalProblem({ input, output: new FakeOutput() }),
      ).toBe(
        'browser-recorder needs an interactive terminal: run it in a terminal window, not through a pipe or a script.',
      );
    });

    it('asks for an interactive terminal when stdout is not a TTY', () => {
      const output = new FakeOutput();
      output.isTTY = false;
      expect(
        interactiveTerminalProblem({ input: new FakeInput(), output }),
      ).toContain('interactive terminal');
    });
  });

  it('accepts the real Node streams and process', () => {
    const deps: NodeTerminalDeps = {
      input: process.stdin,
      output: process.stdout,
      process,
    };
    const { columns, rows } = createNodeTerminal(deps).size();
    expect(columns).toBeGreaterThan(0);
    expect(rows).toBeGreaterThan(0);
  });
});
