import type { Target } from '../../shared/domain/locator.ts';
import type { RecordingEvent } from '../../shared/domain/recording-event.ts';

type Events = readonly RecordingEvent[];
/** A rule answers the new list, or `null` when it does not apply. */
type Rule = (events: Events, next: RecordingEvent) => Events | null;

/** A second click this soon after the first one belongs to a double click. */
const DOUBLE_CLICK_WINDOW_MS = 500;
const CLICKS_IN_A_DOUBLE_CLICK = 2;

function identityOf(target: Target | null): string {
  if (target === null) return 'none';
  return JSON.stringify([target.locator, target.nth, target.framePath]);
}

function targetOf(event: RecordingEvent): Target | null | undefined {
  return 'target' in event ? event.target : undefined;
}

function isSameTarget(left: RecordingEvent, right: RecordingEvent): boolean {
  const leftTarget = targetOf(left);
  const rightTarget = targetOf(right);
  if (leftTarget === undefined || rightTarget === undefined) return false;
  return identityOf(leftTarget) === identityOf(rightTarget);
}

const KEEP_LAST_ON_SAME_TARGET: ReadonlySet<string> = new Set([
  'fill',
  'select-option',
  'scroll',
  'hover',
]);

function isSuperseded(last: RecordingEvent, next: RecordingEvent): boolean {
  if (last.kind !== next.kind || last.pageId !== next.pageId) return false;
  if (next.kind === 'wait-for-url') return true;
  if (!isSameTarget(last, next)) return false;
  if (next.kind === 'check')
    return last.kind === 'check' && last.checked === next.checked;
  return KEEP_LAST_ON_SAME_TARGET.has(next.kind);
}

/** Rules 1, 2 and 4: the newer event replaces the one it supersedes. */
const replaceSuperseded: Rule = (events, next) => {
  const last = events.at(-1);
  if (last === undefined || !isSuperseded(last, next)) return null;
  return [...events.slice(0, -1), next];
};

/** Actions on an element that already show where the pointer was. */
const ACTS_ON_HOVERED_ELEMENT: ReadonlySet<string> = new Set([
  'click',
  'dblclick',
  'check',
  'fill',
  'select-option',
]);

/** Rule 5: the action on the same element already shows where the pointer was. */
const dropHoverBeforeAction: Rule = (events, next) => {
  const last = events.at(-1);
  if (!ACTS_ON_HOVERED_ELEMENT.has(next.kind) || last?.kind !== 'hover') {
    return null;
  }
  if (last.pageId !== next.pageId || !isSameTarget(last, next)) return null;
  return [...events.slice(0, -1), next];
};

function isDoubleClickPart(
  candidate: RecordingEvent | undefined,
  next: RecordingEvent,
): boolean {
  return (
    candidate?.kind === 'click' &&
    next.kind === 'dblclick' &&
    candidate.pageId === next.pageId &&
    isSameTarget(candidate, next) &&
    next.offsetMs - candidate.offsetMs <= DOUBLE_CLICK_WINDOW_MS
  );
}

/** Rule 3: a dblclick absorbs the clicks it is made of. */
const absorbClicks: Rule = (events, next) => {
  let kept = events;
  let firstOffsetMs = next.offsetMs;
  for (let index = 0; index < CLICKS_IN_A_DOUBLE_CLICK; index += 1) {
    const candidate = kept.at(-1);
    if (!isDoubleClickPart(candidate, next) || candidate === undefined) break;
    firstOffsetMs = candidate.offsetMs;
    kept = kept.slice(0, -1);
  }
  if (kept === events) return null;
  const merged = { ...next, offsetMs: firstOffsetMs };
  return dropHoverBeforeAction(kept, merged) ?? [...kept, merged];
};

const RULES: readonly Rule[] = [
  replaceSuperseded,
  absorbClicks,
  dropHoverBeforeAction,
];

/**
 * Adds one event to the timeline, merging it with the tail where the rules
 * say two events are one user action. Never mutates the list it is given.
 */
export function appendEvent(events: Events, next: RecordingEvent): Events {
  for (const rule of RULES) {
    const merged = rule(events, next);
    if (merged !== null) return merged;
  }
  return [...events, next];
}
