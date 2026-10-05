import type { Recording } from '../../src/shared/domain/recording.ts';
import type { RecordingEvent } from '../../src/shared/domain/recording-event.ts';
import type { LibraryEntryView } from '../../src/tui/domain/app-views.ts';

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
    schemaVersion: 1,
    name: 'Checkout flow',
    slug: 'checkout-flow',
    startUrl: 'https://shop.test/',
    createdAt: '2026-10-05T12:30:00.000Z',
    updatedAt: '2026-10-05T12:31:00.000Z',
    status: 'complete',
    durationMs: 60_000,
    viewport: { width: 1280, height: 800 },
    events,
  };
}
