import type { Recording } from '../../src/shared/domain/recording.ts';
import type { RecordingEvent } from '../../src/shared/domain/recording-event.ts';
import type { NewRecordingScreen } from '../../src/tui/domain/app-state.ts';
import type {
  BrowserOptionView,
  LibraryEntryView,
} from '../../src/tui/domain/app-views.ts';
import { emptyField } from '../../src/tui/domain/text-input.ts';
import {
  BRAVE_CHOICE,
  BUNDLED_CHOICE,
  WINDOW_DISPLAY,
} from './browser-fixtures.ts';

export function clickAt(
  offsetMs: number,
  description = 'Button',
): RecordingEvent {
  return {
    kind: 'click',
    offsetMs,
    pageId: 'page1',
    target: {
      locator: { kind: 'css', selector: '#x' },
      nth: null,
      framePath: [],
      description,
    },
    button: 'left',
    modifiers: [],
  };
}

export function passwordFill(offsetMs: number, value: string): RecordingEvent {
  return {
    kind: 'fill',
    offsetMs,
    pageId: 'page1',
    target: {
      locator: { kind: 'label', text: 'Password' },
      nth: null,
      framePath: [],
      description: 'Password',
    },
    value,
    isSensitive: true,
  };
}

/** `count` clicks one second apart, labelled `Step 0`, `Step 1`, ... */
export function clicks(count: number): RecordingEvent[] {
  return Array.from({ length: count }, (_, index) =>
    clickAt(index * 1000, `Step ${String(index)}`),
  );
}

export function validEntry(
  slug: string,
  name = slug,
  overrides: Partial<Extract<LibraryEntryView, { kind: 'valid' }>> = {},
): LibraryEntryView {
  return {
    kind: 'valid',
    slug,
    name,
    createdAt: '2026-10-05T12:30:00.000Z',
    durationMs: 65_000,
    stepCount: 7,
    ...overrides,
  };
}

export function recordingWith(events: readonly RecordingEvent[]): Recording {
  return {
    schemaVersion: 2,
    name: 'Checkout flow',
    slug: 'checkout-flow',
    startUrl: 'https://shop.test/',
    createdAt: '2026-10-05T12:30:00.000Z',
    updatedAt: '2026-10-05T12:31:00.000Z',
    status: 'complete',
    durationMs: 60_000,
    display: WINDOW_DISPLAY,
    browser: BUNDLED_CHOICE,
    events,
  };
}

/** A blank new-recording form; override only what a test cares about. */
export function newRecordingScreen(
  overrides: Partial<NewRecordingScreen> = {},
): NewRecordingScreen {
  return {
    kind: 'new-recording',
    name: emptyField(),
    startUrl: emptyField(),
    focus: 'name',
    browsers: null,
    browserIndex: 0,
    profileIndex: 0,
    error: null,
    ...overrides,
  };
}

/** Brave with three profile options, then the bundled browser with one. */
export const BROWSER_VIEWS: readonly BrowserOptionView[] = [
  {
    browserId: 'brave',
    label: 'Brave',
    profiles: [
      {
        choice: BRAVE_CHOICE,
        label: 'Managed (keeps logins)',
        note: null,
      },
      {
        choice: {
          browserId: 'brave',
          profileMode: 'copy-of-real',
          sourceProfile: 'Default',
        },
        label: 'Copy of Person 1 (Default)',
        note: 'Brave is running: the copy may miss its latest changes',
      },
      {
        choice: { ...BRAVE_CHOICE, profileMode: 'ephemeral' },
        label: 'Ephemeral (clean each time)',
        note: null,
      },
    ],
  },
  {
    browserId: 'bundled',
    label: 'Chromium (bundled)',
    profiles: [
      {
        choice: BUNDLED_CHOICE,
        label: 'Ephemeral (clean each time)',
        note: null,
      },
    ],
  },
];
