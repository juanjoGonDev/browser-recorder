import type { AppState, NewRecordingScreen } from './app-state.ts';
import type { BrowserOptionView } from './app-views.ts';
import { cyclePicker } from './browser-picker.ts';
import { updateScreen } from './screen-update.ts';
import { emptyField } from './text-input.ts';

type FormUpdate = (screen: NewRecordingScreen) => NewRecordingScreen;

export function onForm(state: AppState, update: FormUpdate): AppState {
  return updateScreen(state, 'new-recording', update);
}

/** The form as the screen opens: empty fields, browsers still being detected. */
export function blankForm(): NewRecordingScreen {
  return {
    kind: 'new-recording',
    name: emptyField(),
    startUrl: emptyField(),
    focus: 'name',
    browsers: null,
    browserIndex: 0,
    profileIndex: 0,
    error: null,
  };
}

export function browsersLoaded(
  state: AppState,
  browsers: readonly BrowserOptionView[],
): AppState {
  return onForm(state, (screen) => ({
    ...screen,
    browsers,
    browserIndex: 0,
    profileIndex: 0,
  }));
}

/** An empty list stops the "detecting" wait; the message explains why. */
export function browsersFailed(state: AppState, message: string): AppState {
  return onForm(state, (screen) => ({
    ...screen,
    browsers: [],
    error: message,
  }));
}

function cycle(screen: NewRecordingScreen, delta: number): NewRecordingScreen {
  if (screen.focus !== 'browser' && screen.focus !== 'profile') return screen;
  return cyclePicker(screen, screen.focus, delta);
}

export function cycleOption(state: AppState, delta: number): AppState {
  return onForm(state, (screen) => cycle(screen, delta));
}
