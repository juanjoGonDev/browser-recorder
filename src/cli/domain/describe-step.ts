import type { Target } from '../../shared/domain/locator.ts';
import type {
  RecordingEvent,
  RecordingEventKind,
} from '../../shared/domain/recording-event.ts';
import { sanitize } from '../../shared/domain/terminal-text.ts';

export interface StepDescription {
  readonly kind: string;
  readonly target: string;
}

type Of<K extends RecordingEventKind> = Extract<RecordingEvent, { kind: K }>;

type Describers = {
  readonly [K in RecordingEventKind]: (event: Of<K>) => string;
};

const FIRST_PAGE = 'page1';

/** Query, fragment and credentials often carry tokens: only where it points. */
function placeOf(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.split(/[?#]/u)[0] ?? '';
  }
}

function targetText(target: Target): string {
  return target.description;
}

function filesText(count: number): string {
  return `${String(count)} ${count === 1 ? 'file' : 'files'}`;
}

/**
 * What a step acts on, never what it types: fill, select and dialog values
 * can be secrets and the terminal may be a CI log.
 */
const describers: Describers = {
  goto: (event) => placeOf(event.url),
  'wait-for-url': (event) => placeOf(event.url),
  reload: () => '',
  'go-back': () => '',
  'go-forward': () => '',
  'page-closed': () => '',
  click: (event) => targetText(event.target),
  dblclick: (event) => targetText(event.target),
  hover: (event) => targetText(event.target),
  check: (event) => targetText(event.target),
  fill: (event) => targetText(event.target),
  'select-option': (event) => targetText(event.target),
  press: (event) =>
    event.target === null
      ? event.key
      : `${event.key} in ${targetText(event.target)}`,
  scroll: (event) => `x ${String(event.x)}, y ${String(event.y)}`,
  'drag-and-drop': (event) =>
    `${targetText(event.source)} → ${targetText(event.target)}`,
  'set-input-files': (event) => filesText(event.fileNames.length),
  dialog: (event) => `${event.dialogType} → ${event.action}`,
  'page-opened': (event) => placeOf(event.url),
};

export function describeStep(event: RecordingEvent): StepDescription {
  const describe = describers[event.kind] as (value: RecordingEvent) => string;
  const tag = event.pageId === FIRST_PAGE ? '' : `[${event.pageId}] `;
  return { kind: event.kind, target: sanitize(tag + describe(event)) };
}
