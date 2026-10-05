export type Paint = (text: string) => string;

/** Text styling; every painter is the identity when color is off. */
export interface Style {
  readonly hasColor: boolean;
  readonly bold: Paint;
  readonly dim: Paint;
  readonly inverse: Paint;
  readonly accent: Paint;
  readonly success: Paint;
  readonly warning: Paint;
  readonly danger: Paint;
  readonly muted: Paint;
}

const ESC = String.fromCharCode(0x1b);

function sgr(open: number, close: number): Paint {
  return (text) => `${ESC}[${String(open)}m${text}${ESC}[${String(close)}m`;
}

const identity: Paint = (text) => text;

const BOLD = 1;
const DIM = 2;
const INVERSE = 7;
const RESET_INTENSITY = 22;
const RESET_INVERSE = 27;
const RESET_FOREGROUND = 39;
const RED = 31;
const GREEN = 32;
const YELLOW = 33;
const CYAN = 36;
const BRIGHT_BLACK = 90;

const colorStyle: Style = {
  hasColor: true,
  bold: sgr(BOLD, RESET_INTENSITY),
  dim: sgr(DIM, RESET_INTENSITY),
  inverse: sgr(INVERSE, RESET_INVERSE),
  accent: sgr(CYAN, RESET_FOREGROUND),
  success: sgr(GREEN, RESET_FOREGROUND),
  warning: sgr(YELLOW, RESET_FOREGROUND),
  danger: sgr(RED, RESET_FOREGROUND),
  muted: sgr(BRIGHT_BLACK, RESET_FOREGROUND),
};

const plainStyle: Style = {
  hasColor: false,
  bold: identity,
  dim: identity,
  inverse: identity,
  accent: identity,
  success: identity,
  warning: identity,
  danger: identity,
  muted: identity,
};

export function createStyle(hasColor: boolean): Style {
  return hasColor ? colorStyle : plainStyle;
}
