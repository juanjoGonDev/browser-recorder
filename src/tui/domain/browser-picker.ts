import type { BrowserChoice } from '../../shared/domain/browser-choice.ts';
import type { BrowserOptionView } from './app-views.ts';

export type PickerField = 'browser' | 'profile';

/** The browser and profile cycle fields, shared by the form and the library. */
export interface BrowserPicker {
  /** `null` while the browsers are still being detected. */
  readonly browsers: readonly BrowserOptionView[] | null;
  readonly browserIndex: number;
  /** An index into the profiles of the chosen browser. */
  readonly profileIndex: number;
}

function wrap(index: number, delta: number, length: number): number {
  return (((index + delta) % length) + length) % length;
}

/** Cycles the focused field; another browser restarts the profile choice. */
export function cyclePicker<T extends BrowserPicker>(
  picker: T,
  field: PickerField,
  delta: number,
): T {
  const { browsers, browserIndex, profileIndex } = picker;
  if (browsers === null || browsers.length === 0) return picker;
  if (field === 'browser') {
    const next = wrap(browserIndex, delta, browsers.length);
    return { ...picker, browserIndex: next, profileIndex: 0 };
  }
  const profiles = browsers[browserIndex]?.profiles ?? [];
  if (profiles.length === 0) return picker;
  return {
    ...picker,
    profileIndex: wrap(profileIndex, delta, profiles.length),
  };
}

/** The choice under the cursor, or `null` when there is nothing to pick. */
export function pickedChoice(picker: BrowserPicker): BrowserChoice | null {
  const profile =
    picker.browsers?.[picker.browserIndex]?.profiles[picker.profileIndex];
  return profile?.choice ?? null;
}

export function isSameChoice(a: BrowserChoice, b: BrowserChoice): boolean {
  return (
    a.browserId === b.browserId &&
    a.profileMode === b.profileMode &&
    a.sourceProfile === b.sourceProfile
  );
}

/**
 * Puts the cursor on the current choice. A browser that is no longer detected
 * selects the first option; a vanished profile selects the browser's first.
 */
export function preselectPicker(
  browsers: readonly BrowserOptionView[],
  current: BrowserChoice,
): BrowserPicker {
  const found = browsers.findIndex(
    (view) => view.browserId === current.browserId,
  );
  const browserIndex = Math.max(0, found);
  const profiles = browsers[browserIndex]?.profiles ?? [];
  const profileIndex = Math.max(
    0,
    found < 0 ? -1 : profiles.findIndex((p) => isSameChoice(p.choice, current)),
  );
  return { browsers, browserIndex, profileIndex };
}
