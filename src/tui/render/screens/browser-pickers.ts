import type {
  BrowserPicker,
  PickerField,
} from '../../domain/browser-picker.ts';
import { sanitize } from '../../../shared/domain/terminal-text.ts';
import type { RenderContext } from '../screen-view.ts';

const LABEL_WIDTH = 9;

interface PickerRow {
  readonly title: string;
  readonly value: string;
  readonly position: string;
  readonly isFocused: boolean;
}

function pickerLine(row: PickerRow, context: RenderContext): string {
  const { style } = context;
  const title = row.title.padEnd(LABEL_WIDTH);
  const value = row.isFocused ? `◂ ${row.value} ▸` : row.value;
  const head = row.isFocused ? style.bold(title) : style.muted(title);
  const shown = row.isFocused ? style.accent(value) : value;
  return `  ${head}${shown} ${style.muted(row.position)}`;
}

function position(index: number, count: number): string {
  return `${String(index + 1)}/${String(count)}`;
}

/** The form fields that are not pickers, for a caller sharing the focus. */
type OtherFocus = 'name' | 'url';

/** The browser and profile rows, then the note of the chosen profile. */
export function renderPickers(
  screen: BrowserPicker,
  focus: PickerField | OtherFocus,
  context: RenderContext,
): string[] {
  const { style } = context;
  const { browsers } = screen;
  if (browsers === null) return [`  ${style.muted('Detecting browsers…')}`];
  const browser = browsers[screen.browserIndex];
  if (browser === undefined) {
    return [`  ${style.warning('No browser detected')}`];
  }
  const profile = browser.profiles[screen.profileIndex];
  const rows: PickerRow[] = [
    {
      title: 'Browser',
      value: sanitize(browser.label),
      position: position(screen.browserIndex, browsers.length),
      isFocused: focus === 'browser',
    },
    {
      title: 'Profile',
      value: sanitize(profile?.label ?? ''),
      position: position(screen.profileIndex, browser.profiles.length),
      isFocused: focus === 'profile',
    },
  ];
  const note = profile?.note ?? null;
  return [
    ...rows.map((row) => pickerLine(row, context)),
    ...(note === null ? [] : [`  ${style.warning(`! ${sanitize(note)}`)}`]),
  ];
}
