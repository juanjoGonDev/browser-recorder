import type { Locator, Target } from '../../shared/domain/locator.ts';
import type {
  DialogType,
  PageId,
  RecordingEvent,
} from '../../shared/domain/recording-event.ts';
import type { CapturedEvent } from './captured-event.ts';
import { normalizeKey } from './normalize-key.ts';

/** The part of a browser signal that describes one DOM interaction. */
export interface DomSignalInput {
  readonly pageId: PageId;
  readonly framePath: readonly string[];
  readonly payload: CapturedEvent;
  readonly candidates: readonly Locator[];
}

export interface DialogInput {
  readonly pageId: PageId;
  readonly dialogType: DialogType;
  readonly message: string;
}

export interface DialogAnswer {
  readonly action: 'accept' | 'dismiss';
  readonly promptText: string | null;
}

function toTarget(
  candidates: readonly Locator[],
  framePath: readonly string[],
  description: string,
): Target | null {
  const [locator] = candidates;
  if (locator === undefined) return null;
  return { locator, nth: null, framePath, description };
}

interface Frame {
  readonly pageId: PageId;
  readonly offsetMs: number;
  readonly framePath: readonly string[];
  /** First candidate as a target, `null` when the event has no element. */
  readonly target: Target | null;
}

type Payload<K extends CapturedEvent['kind']> = Extract<
  CapturedEvent,
  { kind: K }
>;

/** One mapper per captured kind, so a new kind is a new entry (OCP). */
type Mappers = {
  [K in CapturedEvent['kind']]: (
    payload: Payload<K>,
    frame: Frame,
  ) => RecordingEvent | null;
};

function at(frame: Frame): { offsetMs: number; pageId: PageId } {
  return { offsetMs: frame.offsetMs, pageId: frame.pageId };
}

function dragEvent(
  payload: Payload<'drag'>,
  frame: Frame,
): RecordingEvent | null {
  const { target } = frame;
  const source = toTarget(
    payload.source.candidates,
    frame.framePath,
    payload.source.description,
  );
  if (target === null || source === null) return null;
  return { ...at(frame), kind: 'drag-and-drop', source, target };
}

const MAPPERS: Mappers = {
  click: (payload, frame) =>
    frame.target && {
      ...at(frame),
      kind: 'click',
      target: frame.target,
      button: payload.button,
      modifiers: payload.modifiers,
    },
  dblclick: (payload, frame) =>
    frame.target && {
      ...at(frame),
      kind: 'dblclick',
      target: frame.target,
      modifiers: payload.modifiers,
    },
  hover: (_payload, frame) =>
    frame.target && { ...at(frame), kind: 'hover', target: frame.target },
  check: (payload, frame) =>
    frame.target && {
      ...at(frame),
      kind: 'check',
      target: frame.target,
      checked: payload.checked,
    },
  input: (payload, frame) =>
    frame.target && {
      ...at(frame),
      kind: 'fill',
      target: frame.target,
      value: payload.value,
      isSensitive: payload.isSensitive,
    },
  select: (payload, frame) =>
    frame.target && {
      ...at(frame),
      kind: 'select-option',
      target: frame.target,
      values: payload.values,
    },
  files: (payload, frame) => ({
    ...at(frame),
    kind: 'set-input-files',
    fileNames: payload.fileNames,
  }),
  key: (payload, frame) => ({
    ...at(frame),
    kind: 'press',
    target: frame.target,
    key: normalizeKey(payload.key),
  }),
  scroll: (payload, frame) => ({
    ...at(frame),
    kind: 'scroll',
    target: frame.target,
    x: payload.x,
    y: payload.y,
  }),
  drag: dragEvent,
};

/**
 * Maps one DOM interaction to the event stored in the recording, or `null`
 * when it names no element and cannot be replayed.
 */
export function domSignalToEvent(
  signal: DomSignalInput,
  offsetMs: number,
): RecordingEvent | null {
  const { payload } = signal;
  const frame: Frame = {
    pageId: signal.pageId,
    offsetMs,
    framePath: signal.framePath,
    target: toTarget(signal.candidates, signal.framePath, payload.description),
  };
  const mapper = MAPPERS[payload.kind] as (
    payload: CapturedEvent,
    frame: Frame,
  ) => RecordingEvent | null;
  return mapper(payload, frame);
}

/** The recorded answer to a dialog; typed text only exists for accepted prompts. */
export function dialogToEvent(
  dialog: DialogInput,
  answer: DialogAnswer,
  offsetMs: number,
): RecordingEvent {
  const hasText = dialog.dialogType === 'prompt' && answer.action === 'accept';
  return {
    kind: 'dialog',
    offsetMs,
    pageId: dialog.pageId,
    dialogType: dialog.dialogType,
    message: dialog.message,
    action: answer.action,
    promptText: hasText ? answer.promptText : null,
  };
}
