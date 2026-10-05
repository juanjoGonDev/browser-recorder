export type ProgressMessage =
  | {
      readonly kind: 'step';
      readonly index: number;
      readonly elapsedMs: number | null;
    }
  | { readonly kind: 'done'; readonly elapsedMs: number | null }
  | {
      readonly kind: 'error';
      readonly index: number | null;
      readonly message: string;
    }
  | { readonly kind: 'log'; readonly text: string };

const STEP_MARKER = /^::step (\d+)(?: (\d+))?$/;
const DONE_MARKER = /^::done(?: (\d+))?$/;
const ERROR_MARKER = /^::error (\d+|-) (.*)$/;

function toNumberOrNull(digits: string | undefined): number | null {
  return digits === undefined ? null : Number(digits);
}

function decodeMessage(raw: string): string {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'string' ? value : raw;
  } catch {
    return raw;
  }
}

/** Reads one stdout line of a generated script; anything else is a log. */
export function parseProgressLine(line: string): ProgressMessage {
  const step = STEP_MARKER.exec(line);
  if (step?.[1] !== undefined) {
    return {
      kind: 'step',
      index: Number(step[1]),
      elapsedMs: toNumberOrNull(step[2]),
    };
  }
  const done = DONE_MARKER.exec(line);
  if (done !== null) {
    return { kind: 'done', elapsedMs: toNumberOrNull(done[1]) };
  }
  const error = ERROR_MARKER.exec(line);
  if (error?.[1] !== undefined && error[2] !== undefined) {
    return {
      kind: 'error',
      index: error[1] === '-' ? null : Number(error[1]),
      message: decodeMessage(error[2]),
    };
  }
  return { kind: 'log', text: line };
}
