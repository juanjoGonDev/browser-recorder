import type { Target } from '../../shared/domain/locator.ts';
import type {
  RecordingEvent,
  RecordingEventKind,
} from '../../shared/domain/recording-event.ts';
import { sanitize } from '../../shared/domain/terminal-text.ts';

/** Fixed length so a masked value never reveals how long the secret is. */
export const MASKED_VALUE = '••••••••';

export interface EventDescription {
  readonly label: string;
  readonly detail: string;
}

type Of<K extends RecordingEventKind> = Extract<RecordingEvent, { kind: K }>;

type Describers = {
  readonly [K in RecordingEventKind]: (event: Of<K>) => string;
};

const FIRST_PAGE = 'page1';
const SEPARATOR = ' · ';

function targetText(target: Target): string {
  return target.description;
}

function clickDetail(event: Of<'click'> | Of<'dblclick'>): string {
  const parts = [targetText(event.target)];
  if (event.kind === 'click' && event.button !== 'left') {
    parts.push(event.button);
  }
  if (event.modifiers.length > 0) parts.push(event.modifiers.join('+'));
  return parts.join(SEPARATOR);
}

function dialogDetail(event: Of<'dialog'>): string {
  const answer = event.promptText === null ? '' : ` "${event.promptText}"`;
  return `${event.dialogType} "${event.message}" → ${event.action}${answer}`;
}

const describers: Describers = {
  goto: (event) => event.url,
  'wait-for-url': (event) => event.url,
  reload: () => '',
  'go-back': () => '',
  'go-forward': () => '',
  'page-closed': () => '',
  click: clickDetail,
  dblclick: clickDetail,
  hover: (event) => targetText(event.target),
  check: (event) =>
    `${targetText(event.target)}${SEPARATOR}${event.checked ? 'checked' : 'unchecked'}`,
  fill: (event) =>
    `${targetText(event.target)} = ${event.isSensitive ? MASKED_VALUE : event.value}`,
  'select-option': (event) =>
    `${targetText(event.target)} = ${event.values.join(', ')}`,
  press: (event) =>
    event.target === null
      ? event.key
      : `${event.key} in ${targetText(event.target)}`,
  scroll: (event) => `x ${String(event.x)}, y ${String(event.y)}`,
  'drag-and-drop': (event) =>
    `${targetText(event.source)} → ${targetText(event.target)}`,
  'set-input-files': (event) => event.fileNames.join(', '),
  dialog: dialogDetail,
  'page-opened': (event) => event.url,
};

/** A one-line, terminal-safe summary of an event; secrets are masked. */
export function describeEvent(event: RecordingEvent): EventDescription {
  const describe = describers[event.kind] as (value: RecordingEvent) => string;
  const tag = event.pageId === FIRST_PAGE ? '' : `[${event.pageId}] `;
  return { label: event.kind, detail: sanitize(tag + describe(event)) };
}
