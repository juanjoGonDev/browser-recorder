/** One key press, shaped like Node's readline keypress event. */
export interface KeyPress {
  /** `null` for printable characters; see `sequence` for those. */
  readonly name: string | null;
  readonly sequence: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
}

export interface TerminalSize {
  readonly columns: number;
  readonly rows: number;
}

/** The only door to the real terminal: the renderers never touch it. */
export interface Terminal {
  size(): TerminalSize;
  write(text: string): void;
  onKey(listener: (key: KeyPress) => void): void;
  onResize(listener: () => void): void;
  /** Alternate screen, hidden cursor, raw mode. */
  enter(): void;
  /** Undoes `enter`; safe to call twice. */
  restore(): void;
}
