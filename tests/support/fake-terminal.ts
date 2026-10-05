import type {
  KeyPress,
  Terminal,
  TerminalSize,
} from '../../src/tui/application/ports/terminal.ts';

export interface FakeTerminal extends Terminal {
  readonly writes: readonly string[];
  readonly restoreCount: number;
  output(): string;
  isEntered(): boolean;
  resize(size: TerminalSize): void;
  /** Presses a named key such as `down`, `return` or `escape`. */
  press(
    name: string,
    modifiers?: Partial<Pick<KeyPress, 'ctrl' | 'meta' | 'shift'>>,
  ): void;
  /** Types printable text, one key press per character. */
  type(text: string): void;
}

const DEFAULT_SIZE: TerminalSize = { columns: 80, rows: 24 };

export function createFakeTerminal(
  initialSize: TerminalSize = DEFAULT_SIZE,
): FakeTerminal {
  let size = initialSize;
  let isEntered = false;
  let restoreCount = 0;
  const writes: string[] = [];
  const keyListeners: ((key: KeyPress) => void)[] = [];
  const resizeListeners: (() => void)[] = [];

  function emit(key: KeyPress): void {
    for (const listener of keyListeners) listener(key);
  }

  return {
    writes,
    get restoreCount() {
      return restoreCount;
    },
    size: () => size,
    write: (text) => {
      writes.push(text);
    },
    output: () => writes.join(''),
    onKey: (listener) => {
      keyListeners.push(listener);
    },
    onResize: (listener) => {
      resizeListeners.push(listener);
    },
    enter: () => {
      isEntered = true;
    },
    restore: () => {
      isEntered = false;
      restoreCount += 1;
    },
    isEntered: () => isEntered,
    resize(next) {
      size = next;
      for (const listener of resizeListeners) listener();
    },
    press(name, modifiers = {}) {
      emit({
        name,
        sequence: name,
        ctrl: modifiers.ctrl ?? false,
        meta: modifiers.meta ?? false,
        shift: modifiers.shift ?? false,
      });
    },
    type(text) {
      for (const character of text) {
        emit({
          name: null,
          sequence: character,
          ctrl: false,
          meta: false,
          shift: false,
        });
      }
    },
  };
}
