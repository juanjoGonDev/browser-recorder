/** Where the command writes: no `console`, so tests can capture every byte. */
export interface CommandOutput {
  /** Text for stdout, newlines included. */
  out(text: string): void;
  /** Text for stderr, newlines included. */
  err(text: string): void;
  /** Settles once everything written reached the streams. */
  flush(): Promise<void>;
  /** Color only on a terminal, and never with NO_COLOR. */
  readonly hasOutColor: boolean;
  readonly hasErrColor: boolean;
}
