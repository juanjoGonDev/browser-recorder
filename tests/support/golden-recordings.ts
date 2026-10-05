import type { Target } from '../../src/shared/domain/locator.ts';
import type { Recording } from '../../src/shared/domain/recording.ts';
import type { RecordingEvent } from '../../src/shared/domain/recording-event.ts';
import { BUNDLED_CHOICE, WINDOW_DISPLAY } from './browser-fixtures.ts';

function targetOf(
  locator: Target['locator'],
  rest: Partial<Target> = {},
): Target {
  return { locator, nth: null, framePath: [], description: 'subject', ...rest };
}

export function recordingOf(
  events: readonly RecordingEvent[],
  overrides: Partial<Recording> = {},
): Recording {
  return {
    schemaVersion: 2,
    name: 'Golden',
    slug: 'golden',
    startUrl: 'https://example.com/',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:10.000Z',
    status: 'complete',
    durationMs: 9000,
    display: WINDOW_DISPLAY,
    browser: BUNDLED_CHOICE,
    events,
    ...overrides,
  };
}

const SAVE = targetOf({ kind: 'role', role: 'button', name: 'Save' });
const EMAIL = targetOf({ kind: 'label', text: 'Email' });
const MENU = targetOf({ kind: 'css', selector: 'nav > .menu' }, { nth: 2 });
const FRAMED = targetOf(
  { kind: 'test-id', testId: 'inner-button' },
  { framePath: ['iframe#outer', 'iframe[name="inner"]'] },
);

/** Navigation, pointer, keyboard, form and scroll events on one page. */
export const BASIC_RECORDING = recordingOf([
  {
    kind: 'page-opened',
    offsetMs: 0,
    pageId: 'page1',
    openerPageId: null,
    cause: 'user',
    url: 'about:blank',
  },
  { kind: 'goto', offsetMs: 0, pageId: 'page1', url: 'https://example.com/' },
  { kind: 'hover', offsetMs: 400, pageId: 'page1', target: MENU },
  {
    kind: 'click',
    offsetMs: 900,
    pageId: 'page1',
    target: SAVE,
    button: 'left',
    modifiers: [],
  },
  {
    kind: 'wait-for-url',
    offsetMs: 1500,
    pageId: 'page1',
    url: 'https://example.com/saved?id=7',
  },
  {
    kind: 'fill',
    offsetMs: 2100,
    pageId: 'page1',
    target: EMAIL,
    value: 'ana@example.com',
    isSensitive: false,
  },
  {
    kind: 'press',
    offsetMs: 2600,
    pageId: 'page1',
    target: EMAIL,
    key: 'Control+A',
  },
  {
    kind: 'press',
    offsetMs: 2900,
    pageId: 'page1',
    target: null,
    key: 'Escape',
  },
  {
    kind: 'check',
    offsetMs: 3200,
    pageId: 'page1',
    target: targetOf({ kind: 'label', text: 'Accept' }),
    checked: true,
  },
  {
    kind: 'select-option',
    offsetMs: 3500,
    pageId: 'page1',
    target: targetOf({ kind: 'css', selector: 'select#size' }),
    values: ['m', 'l'],
  },
  {
    kind: 'scroll',
    offsetMs: 4000,
    pageId: 'page1',
    target: null,
    x: 0,
    y: 640,
  },
  {
    kind: 'dblclick',
    offsetMs: 4400,
    pageId: 'page1',
    target: SAVE,
    modifiers: ['Shift'],
  },
  { kind: 'reload', offsetMs: 5000, pageId: 'page1' },
  { kind: 'go-back', offsetMs: 5600, pageId: 'page1' },
  { kind: 'go-forward', offsetMs: 6100, pageId: 'page1' },
]);

/** Tabs, dialogs, file choosers, frames and drag and drop. */
export const MULTI_TAB_RECORDING = recordingOf([
  {
    kind: 'page-opened',
    offsetMs: 0,
    pageId: 'page1',
    openerPageId: null,
    cause: 'user',
    url: 'about:blank',
  },
  {
    kind: 'goto',
    offsetMs: 0,
    pageId: 'page1',
    url: 'https://example.com/upload',
  },
  {
    kind: 'click',
    offsetMs: 500,
    pageId: 'page1',
    target: FRAMED,
    button: 'right',
    modifiers: ['Alt'],
  },
  {
    kind: 'dialog',
    offsetMs: 800,
    pageId: 'page1',
    dialogType: 'prompt',
    message: 'Name?',
    action: 'accept',
    promptText: 'Ana',
  },
  {
    kind: 'click',
    offsetMs: 1200,
    pageId: 'page1',
    target: targetOf({ kind: 'text', text: 'Choose file' }),
    button: 'left',
    modifiers: [],
  },
  {
    kind: 'set-input-files',
    offsetMs: 1300,
    pageId: 'page1',
    fileNames: ['report.pdf', 'photo.png'],
  },
  {
    kind: 'click',
    offsetMs: 2000,
    pageId: 'page1',
    target: targetOf({ kind: 'text', text: 'Open help' }),
    button: 'middle',
    modifiers: [],
  },
  {
    kind: 'page-opened',
    offsetMs: 2100,
    pageId: 'page2',
    openerPageId: 'page1',
    cause: 'action',
    url: 'https://example.com/help',
  },
  {
    kind: 'dialog',
    offsetMs: 2600,
    pageId: 'page2',
    dialogType: 'confirm',
    message: 'Leave?',
    action: 'dismiss',
    promptText: null,
  },
  {
    kind: 'drag-and-drop',
    offsetMs: 3000,
    pageId: 'page2',
    source: targetOf({ kind: 'placeholder', text: 'Drag me' }),
    target: MENU,
  },
  { kind: 'page-closed', offsetMs: 3500, pageId: 'page2' },
  {
    kind: 'page-opened',
    offsetMs: 4000,
    pageId: 'page3',
    openerPageId: null,
    cause: 'user',
    url: 'about:blank',
  },
  { kind: 'scroll', offsetMs: 4500, pageId: 'page3', target: MENU, x: 3, y: 9 },
  {
    kind: 'goto',
    offsetMs: 4600,
    pageId: 'page3',
    url: 'https://example.com/done',
  },
]);

export const HOSTILE_VALUE = '"); process.exit(1); ("';

/** Every recorded string carries a payload that would break a naive emitter. */
export const HOSTILE_RECORDING = recordingOf(
  [
    {
      kind: 'goto',
      offsetMs: 0,
      pageId: 'page1',
      url: `https://example.com/?q=${HOSTILE_VALUE}`,
    },
    {
      kind: 'fill',
      offsetMs: 100,
      pageId: 'page1',
      target: targetOf({ kind: 'placeholder', text: HOSTILE_VALUE }),
      value: HOSTILE_VALUE,
      isSensitive: true,
    },
    {
      kind: 'fill',
      offsetMs: 200,
      pageId: 'page1',
      target: targetOf(
        { kind: 'css', selector: 'input[name="a\u2028b"] /* */' },
        { framePath: ['iframe[title="\\n"]'] },
      ),
      value: 'line\nbreak */ ${x} `tick`',
      isSensitive: false,
    },
    {
      kind: 'select-option',
      offsetMs: 300,
      pageId: 'page1',
      target: targetOf({ kind: 'text', text: '</script>' }),
      values: [HOSTILE_VALUE, "it's"],
    },
    {
      kind: 'scroll',
      offsetMs: 400,
      pageId: 'page1',
      target: targetOf(
        { kind: 'css', selector: '#a"); process.exit(2); ("' },
        { framePath: ['iframe[title="\\n"]'] },
      ),
      x: 1,
      y: 2,
    },
  ],
  { name: 'Hostile "); evil(); (" name' },
);
