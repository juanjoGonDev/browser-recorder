export interface LineSplitter {
  /** Feeds a chunk and returns the lines it completed, CRLF stripped. */
  push(chunk: string): string[];
  /** Returns the unterminated tail, if any, and resets. */
  flush(): string[];
}

const LINE_BREAK = /\r?\n/;

function withoutBlanks(lines: readonly string[]): string[] {
  return lines.filter((line) => line.length > 0);
}

/** Reassembles lines from arbitrary stream chunks. */
export function createLineSplitter(): LineSplitter {
  let pending = '';
  return {
    push(chunk) {
      const parts = (pending + chunk).split(LINE_BREAK);
      pending = parts.pop() ?? '';
      return withoutBlanks(parts);
    },
    flush() {
      const tail = pending;
      pending = '';
      return withoutBlanks([tail]);
    },
  };
}
