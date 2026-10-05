import { sanitize } from '../../shared/domain/terminal-text.ts';

export type Paint = (text: string) => string;

/** Text styling for the result lines; every painter is the identity off. */
export interface Painter {
  readonly success: Paint;
  readonly danger: Paint;
  readonly muted: Paint;
}

const ESC = String.fromCharCode(0x1b);
const GREEN = 32;
const RED = 31;
const BRIGHT_BLACK = 90;
const RESET_FOREGROUND = 39;
const MS_PER_SECOND = 1000;

function foreground(color: number): Paint {
  return (text) =>
    `${ESC}[${String(color)}m${text}${ESC}[${String(RESET_FOREGROUND)}m`;
}

const identity: Paint = (text) => text;

export function createPainter(hasColor: boolean): Painter {
  return hasColor
    ? {
        success: foreground(GREEN),
        danger: foreground(RED),
        muted: foreground(BRIGHT_BLACK),
      }
    : { success: identity, danger: identity, muted: identity };
}

export interface FailureReport {
  readonly name: string;
  /** The step that was running; `null` before the first one. */
  readonly step: { readonly index: number; readonly kind: string } | null;
  readonly message: string;
  readonly stderrTail: readonly string[];
}

const TAIL_INDENT = '  ';

function firstLine(text: string): string {
  return text.split('\n')[0] ?? '';
}

export function formatSuccess(
  name: string,
  elapsedMs: number,
  painter: Painter,
): string {
  const seconds = (elapsedMs / MS_PER_SECOND).toFixed(1);
  return painter.success(`✔ ${sanitize(name)} replayed in ${seconds}s`);
}

/** The `✖` summary, then the script's last stderr lines. */
export function formatFailure(
  report: FailureReport,
  painter: Painter,
): string[] {
  const where =
    report.step === null
      ? ''
      : ` at step ${String(report.step.index + 1)} (${sanitize(report.step.kind)})`;
  const summary = `✖ ${sanitize(report.name)} failed${where}: ${sanitize(firstLine(report.message))}`;
  return [
    painter.danger(summary),
    ...report.stderrTail.map((line) =>
      painter.muted(`${TAIL_INDENT}${sanitize(line)}`),
    ),
  ];
}

export function formatCancelled(name: string, painter: Painter): string {
  return painter.danger(`■ ${sanitize(name)} cancelled`);
}

export function formatWarning(text: string): string {
  return `! ${sanitize(text)}`;
}
