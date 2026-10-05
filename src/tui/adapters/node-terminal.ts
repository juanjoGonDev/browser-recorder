import { emitKeypressEvents } from 'node:readline';

import type {
  KeyPress,
  Terminal,
  TerminalSize,
} from '../application/ports/terminal.ts';

export interface ReadlineKey {
  readonly name?: string | undefined;
  readonly sequence?: string | undefined;
  readonly ctrl?: boolean | undefined;
  readonly meta?: boolean | undefined;
  readonly shift?: boolean | undefined;
}

type KeypressListener = (
  text: string | undefined,
  key: ReadlineKey | undefined,
) => void;

export interface InputStream {
  readonly isTTY?: boolean | undefined;
  setRawMode?(isEnabled: boolean): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: 'keypress', listener: KeypressListener): unknown;
}

export interface OutputStream {
  readonly isTTY?: boolean | undefined;
  readonly columns?: number | undefined;
  readonly rows?: number | undefined;
  write(text: string): unknown;
  on(event: 'resize', listener: () => void): unknown;
}

export interface ProcessLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  off(event: string, listener: (...args: unknown[]) => void): unknown;
  exit(code: number): unknown;
  readonly stderr: { write(text: string): unknown };
}

export interface NodeTerminalDeps {
  readonly input: InputStream;
  readonly output: OutputStream;
  readonly process: ProcessLike;
}

const ESC = String.fromCharCode(0x1b);
const ENTER_SEQUENCE = [
  `${ESC}[?1049h`,
  `${ESC}[?25l`,
  // Auto-wrap off: a full-width line never wraps onto the next row.
  `${ESC}[?7l`,
  `${ESC}[2J`,
  `${ESC}[H`,
].join('');
const RESTORE_SEQUENCE = [
  `${ESC}[0m`,
  `${ESC}[?7h`,
  `${ESC}[?25h`,
  `${ESC}[?1049l`,
].join('');

const DEFAULT_SIZE: TerminalSize = { columns: 80, rows: 24 };
const EXIT_CODE_ERROR = 1;
const EXIT_CODE_SIGINT = 130;
const EXIT_CODE_SIGTERM = 143;
const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;

export const NOT_INTERACTIVE_MESSAGE =
  'browser-recorder needs an interactive terminal: run it in a terminal window, not through a pipe or a script.';

/** `null` when stdin and stdout are terminals; otherwise what to tell the user. */
export function interactiveTerminalProblem(streams: {
  readonly input: Pick<InputStream, 'isTTY'>;
  readonly output: Pick<OutputStream, 'isTTY'>;
}): string | null {
  const isInteractive =
    streams.input.isTTY === true && streams.output.isTTY === true;
  return isInteractive ? null : NOT_INTERACTIVE_MESSAGE;
}

function isPrintable(sequence: string, key: ReadlineKey | undefined): boolean {
  if (key?.ctrl === true || key?.meta === true) return false;
  const code = sequence.codePointAt(0);
  const isSingle = Array.from(sequence).length === 1;
  return (
    isSingle && code !== undefined && code >= FIRST_PRINTABLE && code !== DELETE
  );
}

/** Printable keys have no name; Enter is `return` however the terminal sends it. */
function nameOf(sequence: string, key: ReadlineKey | undefined): string | null {
  if (isPrintable(sequence, key)) return null;
  return key?.name === 'enter' ? 'return' : (key?.name ?? null);
}

function toKeyPress(
  text: string | undefined,
  key: ReadlineKey | undefined,
): KeyPress | null {
  const sequence = key?.sequence ?? text;
  if (sequence === undefined) return null;
  return {
    name: nameOf(sequence, key),
    sequence,
    ctrl: key?.ctrl ?? false,
    meta: key?.meta ?? false,
    shift: key?.shift ?? false,
  };
}

function describeFailure(reason: unknown): string {
  if (reason instanceof Error) return reason.stack ?? reason.message;
  return String(reason);
}

export function createNodeTerminal(deps: NodeTerminalDeps): Terminal {
  return new NodeTerminal(deps);
}

class NodeTerminal implements Terminal {
  private readonly deps: NodeTerminalDeps;
  private isEntered = false;
  private readonly guards: readonly (readonly [
    string,
    (...args: unknown[]) => void,
  ])[];

  constructor(deps: NodeTerminalDeps) {
    this.deps = deps;
    this.guards = [
      [
        'uncaughtException',
        (error) => {
          this.crash(error);
        },
      ],
      [
        'unhandledRejection',
        (reason) => {
          this.crash(reason);
        },
      ],
      [
        'SIGINT',
        () => {
          this.leaveWith(EXIT_CODE_SIGINT);
        },
      ],
      [
        'SIGTERM',
        () => {
          this.leaveWith(EXIT_CODE_SIGTERM);
        },
      ],
      [
        'exit',
        () => {
          this.restore();
        },
      ],
    ];
  }

  size(): TerminalSize {
    const { columns, rows } = this.deps.output;
    return {
      columns: columns ?? DEFAULT_SIZE.columns,
      rows: rows ?? DEFAULT_SIZE.rows,
    };
  }

  write(text: string): void {
    this.deps.output.write(text);
  }

  onKey(listener: (key: KeyPress) => void): void {
    // The stream is only used for its events; Node's typing wants a full one.
    emitKeypressEvents(this.deps.input as unknown as NodeJS.ReadableStream);
    this.deps.input.on('keypress', (text, key) => {
      const press = toKeyPress(text, key);
      if (press !== null) listener(press);
    });
  }

  onResize(listener: () => void): void {
    this.deps.output.on('resize', listener);
  }

  enter(): void {
    if (this.isEntered) return;
    this.isEntered = true;
    for (const [event, guard] of this.guards)
      this.deps.process.on(event, guard);
    this.deps.output.write(ENTER_SEQUENCE);
    this.deps.input.setRawMode?.(true);
    this.deps.input.resume();
  }

  restore(): void {
    if (!this.isEntered) return;
    this.isEntered = false;
    for (const [event, guard] of this.guards)
      this.deps.process.off(event, guard);
    this.deps.input.setRawMode?.(false);
    this.deps.input.pause();
    this.deps.output.write(RESTORE_SEQUENCE);
  }

  private crash(reason: unknown): void {
    this.restore();
    this.deps.process.stderr.write(`${describeFailure(reason)}\n`);
    this.deps.process.exit(EXIT_CODE_ERROR);
  }

  private leaveWith(code: number): void {
    this.restore();
    this.deps.process.exit(code);
  }
}
